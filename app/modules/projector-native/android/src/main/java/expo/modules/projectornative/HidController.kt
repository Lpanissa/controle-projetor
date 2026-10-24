package expo.modules.projectornative

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothHidDevice
import android.bluetooth.BluetoothHidDeviceAppSdpSettings
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.concurrent.Executors

/**
 * Faz o celular se apresentar ao projetor como teclado + controle de mídia + mouse Bluetooth.
 * Assim não precisa instalar nada nem liberar depuração no projetor.
 */
@SuppressLint("MissingPermission")
object HidController {
  private const val TAG = "ProjetorHID"

  const val ID_KEYBOARD: Int = 1
  const val ID_CONSUMER: Int = 2
  const val ID_MOUSE: Int = 3

  private val DESCRIPTOR: ByteArray = intArrayOf(
    // ---- Teclado (report 1) ----
    0x05, 0x01, 0x09, 0x06, 0xA1, 0x01, 0x85, 0x01,
    0x05, 0x07, 0x19, 0xE0, 0x29, 0xE7, 0x15, 0x00, 0x25, 0x01, 0x75, 0x01, 0x95, 0x08, 0x81, 0x02,
    0x95, 0x01, 0x75, 0x08, 0x81, 0x01,
    0x95, 0x06, 0x75, 0x08, 0x15, 0x00, 0x25, 0x65, 0x05, 0x07, 0x19, 0x00, 0x29, 0x65, 0x81, 0x00,
    0xC0,
    // ---- Controle de mídia / sistema (report 2) ----
    0x05, 0x0C, 0x09, 0x01, 0xA1, 0x01, 0x85, 0x02,
    0x15, 0x00, 0x26, 0xFF, 0x03, 0x19, 0x00, 0x2A, 0xFF, 0x03,
    0x75, 0x10, 0x95, 0x01, 0x81, 0x00,
    0xC0,
    // ---- Mouse (report 3) ----
    0x05, 0x01, 0x09, 0x02, 0xA1, 0x01, 0x85, 0x03, 0x09, 0x01, 0xA1, 0x00,
    0x05, 0x09, 0x19, 0x01, 0x29, 0x03, 0x15, 0x00, 0x25, 0x01, 0x95, 0x03, 0x75, 0x01, 0x81, 0x02,
    0x95, 0x01, 0x75, 0x05, 0x81, 0x01,
    0x05, 0x01, 0x09, 0x30, 0x09, 0x31, 0x09, 0x38, 0x15, 0x81, 0x25, 0x7F, 0x75, 0x08, 0x95, 0x03, 0x81, 0x06,
    0xC0, 0xC0
  ).map { it.toByte() }.toByteArray()

  private var appContext: Context? = null
  private var adapter: BluetoothAdapter? = null
  private var hid: BluetoothHidDevice? = null
  private var registered = false
  var connected: BluetoothDevice? = null
    private set
  private var wantedAddress: String? = null
  private val executor = Executors.newSingleThreadExecutor()
  private val main = Handler(Looper.getMainLooper())

  /** Avisa o JS / a notificação quando o estado muda. */
  val listeners = java.util.concurrent.CopyOnWriteArrayList<(String, String?) -> Unit>()

  val state: String
    get() = when {
      connected != null -> "connected"
      registered -> "ready"
      hid != null -> "starting"
      else -> "off"
    }

  fun init(ctx: Context) {
    if (android.os.Build.VERSION.SDK_INT < 28) return
    if (appContext != null && hid != null) return
    appContext = ctx.applicationContext
    val manager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    adapter = manager?.adapter
    val a = adapter ?: return
    a.getProfileProxy(ctx.applicationContext, object : BluetoothProfile.ServiceListener {
      override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
        if (profile != BluetoothProfile.HID_DEVICE) return
        hid = proxy as BluetoothHidDevice
        register()
      }

      override fun onServiceDisconnected(profile: Int) {
        if (profile == BluetoothProfile.HID_DEVICE) {
          hid = null
          registered = false
          connected = null
          notifyState()
        }
      }
    }, BluetoothProfile.HID_DEVICE)
  }

  private val callback = object : BluetoothHidDevice.Callback() {
    override fun onAppStatusChanged(pluggedDevice: BluetoothDevice?, registered: Boolean) {
      this@HidController.registered = registered
      Log.d(TAG, "registrado=$registered")
      if (registered) {
        val target = pluggedDevice ?: wantedAddress?.let { adapter?.getRemoteDevice(it) }
        if (target != null) hid?.connect(target)
      }
      notifyState()
    }

    override fun onConnectionStateChanged(device: BluetoothDevice, state: Int) {
      when (state) {
        BluetoothProfile.STATE_CONNECTED -> connected = device
        BluetoothProfile.STATE_DISCONNECTED -> if (connected?.address == device.address) connected = null
      }
      notifyState()
    }
  }

  private fun register() {
    val h = hid ?: return
    val sdp = BluetoothHidDeviceAppSdpSettings(
      "Controle do Projetor",
      "Controle remoto do Panissa",
      "Panissa",
      BluetoothHidDevice.SUBCLASS1_COMBO,
      DESCRIPTOR
    )
    try {
      h.registerApp(sdp, null, null, executor, callback)
    } catch (e: Exception) {
      Log.e(TAG, "registerApp falhou", e)
    }
  }

  private fun notifyState() {
    val s = state
    val n = try { connected?.name } catch (e: Exception) { null }
    main.post { listeners.forEach { it(s, n) } }
  }

  fun bondedDevices(): List<Map<String, String>> {
    val a = adapter ?: return emptyList()
    return try {
      a.bondedDevices.map { mapOf("name" to (it.name ?: it.address), "address" to it.address) }
    } catch (e: Exception) {
      emptyList()
    }
  }

  fun connect(address: String): Boolean {
    wantedAddress = address
    val h = hid ?: return false
    val dev = adapter?.getRemoteDevice(address) ?: return false
    return try { h.connect(dev) } catch (e: Exception) { false }
  }

  fun disconnect() {
    val d = connected ?: return
    try { hid?.disconnect(d) } catch (_: Exception) {}
  }

  fun isBluetoothOn(): Boolean = adapter?.isEnabled == true

  private fun send(id: Int, data: ByteArray): Boolean {
    val h = hid ?: return false
    val d = connected ?: return false
    return try { h.sendReport(d, id, data) } catch (e: Exception) { false }
  }

  // ---------- Teclado ----------
  fun keyDown(usage: Int, modifiers: Int = 0): Boolean =
    send(ID_KEYBOARD, byteArrayOf(modifiers.toByte(), 0, usage.toByte(), 0, 0, 0, 0, 0))

  fun keyUp(): Boolean = send(ID_KEYBOARD, ByteArray(8))

  fun tapKey(usage: Int, modifiers: Int = 0): Boolean {
    val ok = keyDown(usage, modifiers)
    Thread.sleep(25)
    keyUp()
    return ok
  }

  // ---------- Mídia / sistema ----------
  fun consumer(usage: Int): Boolean {
    val ok = send(ID_CONSUMER, byteArrayOf((usage and 0xFF).toByte(), ((usage shr 8) and 0xFF).toByte()))
    Thread.sleep(25)
    send(ID_CONSUMER, byteArrayOf(0, 0))
    return ok
  }

  // ---------- Mouse ----------
  private var buttons = 0

  fun mouseMove(dx: Int, dy: Int, wheel: Int = 0): Boolean {
    var x = dx
    var y = dy
    var ok = true
    // relatórios aceitam -127..127; divide movimentos grandes
    do {
      val sx = x.coerceIn(-127, 127)
      val sy = y.coerceIn(-127, 127)
      ok = send(ID_MOUSE, byteArrayOf(buttons.toByte(), sx.toByte(), sy.toByte(), wheel.coerceIn(-127, 127).toByte())) && ok
      x -= sx
      y -= sy
    } while (x != 0 || y != 0)
    return ok
  }

  fun click(): Boolean {
    buttons = 1
    val ok = send(ID_MOUSE, byteArrayOf(1, 0, 0, 0))
    Thread.sleep(30)
    buttons = 0
    send(ID_MOUSE, byteArrayOf(0, 0, 0, 0))
    return ok
  }

  // ---------- Digitar texto ----------
  fun typeText(text: String): Boolean {
    var ok = true
    for (c in text) {
      val code = charToUsage(c) ?: continue
      ok = tapKey(code.first, code.second) && ok
      Thread.sleep(15)
    }
    return ok
  }

  private const val SHIFT = 0x02

  private fun charToUsage(c: Char): Pair<Int, Int>? {
    return when (c) {
      in 'a'..'z' -> Pair(0x04 + (c - 'a'), 0)
      in 'A'..'Z' -> Pair(0x04 + (c - 'A'), SHIFT)
      in '1'..'9' -> Pair(0x1E + (c - '1'), 0)
      '0' -> Pair(0x27, 0)
      ' ' -> Pair(0x2C, 0)
      '\n' -> Pair(0x28, 0)
      '-' -> Pair(0x2D, 0)
      '_' -> Pair(0x2D, SHIFT)
      '=' -> Pair(0x2E, 0)
      '+' -> Pair(0x2E, SHIFT)
      '.' -> Pair(0x37, 0)
      ',' -> Pair(0x36, 0)
      '/' -> Pair(0x38, 0)
      '?' -> Pair(0x38, SHIFT)
      ':' -> Pair(0x33, SHIFT)
      ';' -> Pair(0x33, 0)
      '!' -> Pair(0x1E, SHIFT)
      '@' -> Pair(0x1F, SHIFT)
      '#' -> Pair(0x20, SHIFT)
      '&' -> Pair(0x24, SHIFT)
      '(' -> Pair(0x26, SHIFT)
      ')' -> Pair(0x27, SHIFT)
      '\'' -> Pair(0x34, 0)
      '"' -> Pair(0x34, SHIFT)
      else -> {
        // tira acento (á -> a) para pelo menos digitar a letra
        val plain = java.text.Normalizer.normalize(c.toString(), java.text.Normalizer.Form.NFD)
          .replace(Regex("\\p{M}"), "")
        if (plain.length == 1 && plain[0] != c) charToUsage(plain[0]) else null
      }
    }
  }
}
