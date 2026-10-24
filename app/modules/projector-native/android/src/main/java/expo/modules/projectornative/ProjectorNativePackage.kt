package expo.modules.projectornative

import android.app.Activity
import android.app.Application
import expo.modules.core.interfaces.ApplicationLifecycleListener
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.view.Window
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.util.concurrent.Executors

/** Estado compartilhado entre a Activity e o módulo JS. */
object SharedState {
  var volumeKeysEnabled = false
  var pendingShare: String? = null
  var onShare: ((String) -> Unit)? = null
  val worker = Executors.newSingleThreadExecutor()

  fun handleIntent(intent: Intent?) {
    if (intent?.action != Intent.ACTION_SEND) return
    val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return
    pendingShare = text
    onShare?.invoke(text)
  }
}

/** Repassa os botões de volume do celular para o projetor (quando ligado nos ajustes). */
class KeyInterceptor(private val base: Window.Callback) : Window.Callback by base {
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val code = event.keyCode
    if (SharedState.volumeKeysEnabled && HidController.connected != null &&
      (code == KeyEvent.KEYCODE_VOLUME_UP || code == KeyEvent.KEYCODE_VOLUME_DOWN)
    ) {
      if (event.action == KeyEvent.ACTION_DOWN) {
        val usage = if (code == KeyEvent.KEYCODE_VOLUME_UP) 0xE9 else 0xEA
        SharedState.worker.execute { HidController.consumer(usage) }
      }
      return true
    }
    return base.dispatchKeyEvent(event)
  }
}

/** Guarda o erro se o app fechar sozinho, e mostra na próxima vez que abrir (para o Claude corrigir). */
object CrashReport {
  private const val FILE = "ultimo_erro.txt"

  fun install(app: Application) {
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { t, e ->
      try {
        val sw = java.io.StringWriter()
        e.printStackTrace(java.io.PrintWriter(sw))
        val report = "Android ${android.os.Build.VERSION.RELEASE} · ${android.os.Build.MODEL}\nThread: ${t.name}\n\n$sw"
        java.io.File(app.filesDir, FILE).writeText(report)
        // também salva na pasta Downloads do celular, para dá pra mandar o arquivo
        if (android.os.Build.VERSION.SDK_INT >= 29) {
          val values = android.content.ContentValues().apply {
            put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, "erro-controle-projetor.txt")
            put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "text/plain")
            put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, "Download")
          }
          val uri = app.contentResolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
          if (uri != null) app.contentResolver.openOutputStream(uri)?.use { it.write(report.toByteArray()) }
        }
      } catch (_: Throwable) {}
      previous?.uncaughtException(t, e)
    }
  }

  fun showIfAny(activity: Activity) {
    val f = java.io.File(activity.filesDir, FILE)
    if (!f.exists()) return
    val text = try { f.readText() } catch (_: Throwable) { "" }
    f.delete()
    if (text.isBlank()) return
    val tv = android.widget.TextView(activity).apply {
      this.text = text.take(6000)
      setTextIsSelectable(true)
      textSize = 11f
      setPadding(40, 30, 40, 30)
    }
    val scroll = android.widget.ScrollView(activity).apply { addView(tv) }
    android.app.AlertDialog.Builder(activity)
      .setTitle("O app fechou da última vez")
      .setView(scroll)
      .setPositiveButton("Copiar erro") { _, _ ->
        val cm = activity.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        cm.setPrimaryClip(android.content.ClipData.newPlainText("erro", text))
        android.widget.Toast.makeText(activity, "Copiado. Cole na conversa com o Claude.", android.widget.Toast.LENGTH_LONG).show()
      }
      .setNegativeButton("Fechar", null)
      .show()
  }
}

class ProjectorNativePackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> {
    return listOf(object : ApplicationLifecycleListener {
      override fun onCreate(application: Application) {
        CrashReport.install(application)
      }
    })
  }

  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> {
    return listOf(object : ReactActivityLifecycleListener {
      override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
        try {
          val w = activity.window
          val cb = w.callback
          if (cb != null && cb !is KeyInterceptor) w.callback = KeyInterceptor(cb)
        } catch (_: Throwable) {}
        SharedState.handleIntent(activity.intent)
      }

      override fun onResume(activity: Activity) {
        try { CrashReport.showIfAny(activity) } catch (_: Throwable) {}
      }

      override fun onNewIntent(intent: Intent?): Boolean {
        SharedState.handleIntent(intent)
        return false
      }
    })
  }
}
