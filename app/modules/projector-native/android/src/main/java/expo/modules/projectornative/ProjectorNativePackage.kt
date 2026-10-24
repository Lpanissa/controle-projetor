package expo.modules.projectornative

import android.app.Activity
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

class ProjectorNativePackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> {
    return listOf(object : ReactActivityLifecycleListener {
      override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
        val w = activity.window
        val cb = w.callback
        if (cb != null && cb !is KeyInterceptor) w.callback = KeyInterceptor(cb)
        SharedState.handleIntent(activity.intent)
      }

      override fun onNewIntent(intent: Intent?): Boolean {
        SharedState.handleIntent(intent)
        return false
      }
    })
  }
}
