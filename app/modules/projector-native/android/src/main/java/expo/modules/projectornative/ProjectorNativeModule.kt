package expo.modules.projectornative

import android.bluetooth.BluetoothAdapter
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ProjectorNativeModule : Module() {
  private val ctx: Context
    get() = appContext.reactContext ?: throw IllegalStateException("sem contexto")

  private val stateListener: (String, String?) -> Unit = { s, n ->
    sendEvent("onHidState", mapOf("state" to s, "name" to n))
  }

  override fun definition() = ModuleDefinition {
    Name("ProjectorNative")

    Events("onHidState", "onShare")

    OnCreate {
      HidController.listeners.add(stateListener)
      SharedState.onShare = { text -> sendEvent("onShare", mapOf("text" to text)) }
    }

    OnDestroy {
      HidController.listeners.remove(stateListener)
      SharedState.onShare = null
    }

    // ---------- Bluetooth ----------
    Function("startHid") {
      HidController.init(ctx)
      HidController.state
    }

    Function("hidState") {
      mapOf(
        "state" to HidController.state,
        "name" to (try { HidController.connected?.name } catch (e: Exception) { null }),
        "bluetoothOn" to HidController.isBluetoothOn()
      )
    }

    Function("bondedDevices") { HidController.bondedDevices() }

    Function("myName") { HidController.myName() }

    AsyncFunction("connect") { address: String ->
      ctx.getSharedPreferences("projetor_prefs", Context.MODE_PRIVATE).edit()
        .putString("last_device", address).apply()
      HidController.connect(address)
    }

    Function("lastDevice") {
      ctx.getSharedPreferences("projetor_prefs", Context.MODE_PRIVATE).getString("last_device", null)
    }

    AsyncFunction("disconnect") { HidController.disconnect() }

    Function("requestDiscoverable") {
      val i = Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE)
        .putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 120)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      val act = appContext.currentActivity
      if (act != null) act.startActivity(i) else ctx.startActivity(i)
    }

    Function("openBluetoothSettings") {
      val i = Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(i)
    }

    AsyncFunction("key") { usage: Int, modifiers: Int -> HidController.tapKey(usage, modifiers) }
    AsyncFunction("consumer") { usage: Int -> HidController.consumer(usage) }
    AsyncFunction("mouseMove") { dx: Int, dy: Int, wheel: Int -> HidController.mouseMove(dx, dy, wheel) }
    AsyncFunction("click") { HidController.click() }
    AsyncFunction("typeText") { text: String -> HidController.typeText(text) }

    // ---------- Infravermelho ----------
    Function("hasIr") { IrController.hasIr(ctx) }
    AsyncFunction("sendNec") { address: Int, command: Int -> IrController.sendNec(ctx, address, command) }
    Function("savePowerCode") { address: Int, command: Int -> IrController.savePower(ctx, address, command) }
    Function("hasPowerCode") { IrController.hasPowerCode(ctx) }
    AsyncFunction("power") { ControlService.powerToggle(ctx) }

    // ---------- Notificação / timer ----------
    Function("startService") { ControlService.start(ctx) }
    Function("stopService") { ControlService.start(ctx, ControlService.ACTION_STOP) }
    Function("sleepTimer") { minutes: Int ->
      ControlService.start(ctx, ControlService.ACTION_SLEEP, minutes)
    }
    Function("sleepAt") { ControlService.sleepAt.toDouble() }

    // ---------- Volume do celular / compartilhar ----------
    Function("setVolumeKeys") { enabled: Boolean -> SharedState.volumeKeysEnabled = enabled }
    Function("consumeShare") {
      val t = SharedState.pendingShare
      SharedState.pendingShare = null
      t
    }
  }
}
