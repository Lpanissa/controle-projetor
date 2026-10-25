package com.panissa.projetor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.media.MediaMetadata
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.ByteArrayOutputStream
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * Servidor simples no Wi-Fi (porta 8765) que o app do celular usa para:
 * listar apps com ícone, abrir apps, abrir links de séries e saber o que está passando.
 */
class BridgeService : Service() {
  companion object {
    const val PORT = 8765
    private const val TAG = "ProjetorPonte"
    var running = false
      private set

    fun start(ctx: Context) {
      val i = Intent(ctx, BridgeService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i) else ctx.startService(i)
    }
  }

  private var server: ServerSocket? = null
  private val pool = Executors.newFixedThreadPool(6)
  private val main = Handler(Looper.getMainLooper())
  private val iconCache = ConcurrentHashMap<String, ByteArray>()

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    startForeground(1, notification())
    running = true
    Thread({ serve() }, "ponte-http").start()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

  override fun onDestroy() {
    running = false
    try { server?.close() } catch (_: Exception) {}
    super.onDestroy()
  }

  private fun notification(): Notification {
    val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(NotificationChannel("ponte", "Projetor Ponte", NotificationManager.IMPORTANCE_MIN))
      Notification.Builder(this, "ponte")
    } else {
      @Suppress("DEPRECATION") Notification.Builder(this)
    }
    return b.setContentTitle("Projetor Ponte").setContentText("Pronto para o controle do celular")
      .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth).build()
  }

  private fun serve() {
    try {
      server = ServerSocket(PORT).also { it.reuseAddress = true }
      while (running) {
        val s = server!!.accept()
        pool.execute { handle(s) }
      }
    } catch (e: Exception) {
      Log.e(TAG, "servidor parou", e)
    }
  }

  private fun handle(sock: Socket) {
    sock.use { s ->
      try {
        s.soTimeout = 5000
        val reader = BufferedReader(InputStreamReader(s.getInputStream()))
        val line = reader.readLine() ?: return
        // consome os cabeçalhos
        while (true) {
          val h = reader.readLine() ?: break
          if (h.isEmpty()) break
        }
        val target = line.split(" ").getOrNull(1) ?: "/"
        val path = target.substringBefore("?")
        val query = parseQuery(target.substringAfter("?", ""))
        val out = s.getOutputStream()
        when (path) {
          "/ping" -> json(out, JSONObject().put("name", Build.MODEL ?: "Projetor").put("app", "ponte").put("version", 1))
          "/apps" -> json(out, listApps())
          "/icon" -> icon(out, query["pkg"] ?: "")
          "/launch" -> json(out, JSONObject().put("ok", launch(query["pkg"] ?: "")))
          "/open" -> json(out, JSONObject().put("ok", openUrl(query["url"] ?: "", query["pkg"])))
          "/nowplaying" -> json(out, nowPlaying())
          "/discoverable" -> json(out, JSONObject().put("ok", onMain { makeDiscoverable(this) }))
          else -> send(out, 404, "text/plain", "nao encontrado".toByteArray())
        }
      } catch (e: Exception) {
        Log.w(TAG, "erro na requisicao", e)
      }
    }
  }

  private fun parseQuery(q: String): Map<String, String> =
    q.split("&").filter { it.contains("=") }.associate {
      val (k, v) = it.split("=", limit = 2)
      URLDecoder.decode(k, "UTF-8") to URLDecoder.decode(v, "UTF-8")
    }

  private fun send(out: OutputStream, code: Int, type: String, body: ByteArray) {
    val status = if (code == 200) "OK" else "Not Found"
    out.write(
      ("HTTP/1.1 $code $status\r\nContent-Type: $type\r\nContent-Length: ${body.size}\r\n" +
        "Access-Control-Allow-Origin: *\r\nCache-Control: max-age=3600\r\nConnection: close\r\n\r\n").toByteArray()
    )
    out.write(body)
    out.flush()
  }

  private fun json(out: OutputStream, data: Any) =
    send(out, 200, "application/json; charset=utf-8", data.toString().toByteArray(Charsets.UTF_8))

  // ---------- apps instalados ----------
  private fun listApps(): JSONArray {
    val pm = packageManager
    val seen = LinkedHashMap<String, String>()
    for (cat in listOf("android.intent.category.LEANBACK_LAUNCHER", Intent.CATEGORY_LAUNCHER)) {
      val i = Intent(Intent.ACTION_MAIN).addCategory(cat)
      for (ri in pm.queryIntentActivities(i, 0)) {
        val pkg = ri.activityInfo.packageName
        if (pkg == packageName || seen.containsKey(pkg)) continue
        seen[pkg] = ri.loadLabel(pm).toString()
      }
    }
    val arr = JSONArray()
    seen.entries.sortedBy { it.value.lowercase() }.forEach {
      arr.put(JSONObject().put("pkg", it.key).put("label", it.value))
    }
    return arr
  }

  private fun icon(out: OutputStream, pkg: String) {
    val bytes = iconCache.getOrPut(pkg) {
      try {
        val d = packageManager.getApplicationIcon(pkg)
        val bmp = toBitmap(d, 128)
        val bos = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.PNG, 100, bos)
        bos.toByteArray()
      } catch (e: PackageManager.NameNotFoundException) {
        ByteArray(0)
      }
    }
    if (bytes.isEmpty()) send(out, 404, "text/plain", ByteArray(0)) else send(out, 200, "image/png", bytes)
  }

  private fun toBitmap(d: Drawable, size: Int): Bitmap {
    if (d is BitmapDrawable && d.bitmap != null) return Bitmap.createScaledBitmap(d.bitmap, size, size, true)
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    d.setBounds(0, 0, size, size)
    d.draw(c)
    return bmp
  }

  // ---------- abrir apps e links ----------
  private fun onMain(block: () -> Boolean): Boolean {
    val latch = java.util.concurrent.CountDownLatch(1)
    var ok = false
    main.post {
      ok = try { block() } catch (e: Exception) { Log.w(TAG, "falhou", e); false }
      latch.countDown()
    }
    latch.await(3, java.util.concurrent.TimeUnit.SECONDS)
    return ok
  }

  private fun launch(pkg: String): Boolean = onMain {
    val pm = packageManager
    val i = (if (Build.VERSION.SDK_INT >= 21) pm.getLeanbackLaunchIntentForPackage(pkg) else null)
      ?: pm.getLaunchIntentForPackage(pkg) ?: return@onMain false
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
    startActivity(i)
    true
  }

  private fun openUrl(url: String, pkg: String?): Boolean {
    if (url.isBlank()) return false
    val opened = onMain {
      val i = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if (!pkg.isNullOrBlank() && isInstalled(pkg)) {
        i.setPackage(pkg)
        try { startActivity(i); return@onMain true } catch (_: Exception) { i.setPackage(null) }
      }
      try { startActivity(i); true } catch (_: Exception) { false }
    }
    // se nenhum app aceitou o link, pelo menos abre o app da série
    if (!opened && !pkg.isNullOrBlank()) return launch(pkg)
    return opened
  }

  private fun isInstalled(pkg: String): Boolean =
    try { packageManager.getPackageInfo(pkg, 0); true } catch (_: Exception) { false }

  // ---------- o que está passando ----------
  private fun nowPlaying(): JSONObject {
    val res = JSONObject()
    try {
      val msm = getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager
      val sessions = msm.getActiveSessions(ComponentName(this, MediaListener::class.java))
      val ctrl = sessions.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING } ?: sessions.firstOrNull()
        ?: return res
      val md = ctrl.metadata ?: return res
      val title = md.getString(MediaMetadata.METADATA_KEY_TITLE)
        ?: md.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE) ?: return res
      val sub = md.getString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE)
        ?: md.getString(MediaMetadata.METADATA_KEY_ALBUM)
        ?: md.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: ""
      val label = try {
        packageManager.getApplicationLabel(packageManager.getApplicationInfo(ctrl.packageName, 0)).toString()
      } catch (_: Exception) { ctrl.packageName }
      res.put("pkg", ctrl.packageName).put("appLabel", label).put("title", title).put("subtitle", sub)
        .put("playing", ctrl.playbackState?.state == PlaybackState.STATE_PLAYING)
    } catch (e: SecurityException) {
      res.put("error", "sem_permissao")
    } catch (e: Exception) {
      res.put("error", e.message ?: "erro")
    }
    return res
  }
}
