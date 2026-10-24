package expo.modules.projectornative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.util.concurrent.Executors

/** Mantém a conexão Bluetooth viva e mostra o controle na notificação. */
class ControlService : Service() {
  companion object {
    const val CHANNEL = "controle_projetor"
    const val NOTIF_ID = 4021
    const val ACTION_START = "start"
    const val ACTION_STOP = "stop"
    const val ACTION_VOL_DOWN = "vol_down"
    const val ACTION_VOL_UP = "vol_up"
    const val ACTION_PLAY = "play"
    const val ACTION_POWER = "power"
    const val ACTION_SLEEP = "sleep"
    const val ACTION_SLEEP_CANCEL = "sleep_cancel"
    const val EXTRA_MINUTES = "minutes"

    var sleepAt: Long = 0L
      private set

    fun start(ctx: Context, action: String = ACTION_START, minutes: Int = 0) {
      val i = Intent(ctx, ControlService::class.java).setAction(action).putExtra(EXTRA_MINUTES, minutes)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i) else ctx.startService(i)
    }

    /** Desliga: infravermelho se tiver código salvo, senão o botão "power" pelo Bluetooth. */
    fun powerToggle(ctx: Context) {
      if (!IrController.sendPower(ctx)) HidController.consumer(0x30)
    }
  }

  private val worker = Executors.newSingleThreadExecutor()
  private val handler = Handler(Looper.getMainLooper())
  private val sleepRunnable = Runnable {
    sleepAt = 0L
    worker.execute { powerToggle(this) }
    refresh()
  }

  private val stateListener: (String, String?) -> Unit = { _, _ -> refresh() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    HidController.init(this)
    HidController.listeners.add(stateListener)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startAsForeground()
    when (intent?.action) {
      ACTION_STOP -> {
        handler.removeCallbacks(sleepRunnable)
        sleepAt = 0L
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_VOL_DOWN -> worker.execute { HidController.consumer(0xEA) }
      ACTION_VOL_UP -> worker.execute { HidController.consumer(0xE9) }
      ACTION_PLAY -> worker.execute { HidController.consumer(0xCD) }
      ACTION_POWER -> worker.execute { powerToggle(this) }
      ACTION_SLEEP -> {
        val min = intent.getIntExtra(EXTRA_MINUTES, 0)
        handler.removeCallbacks(sleepRunnable)
        if (min > 0) {
          sleepAt = System.currentTimeMillis() + min * 60_000L
          handler.postDelayed(sleepRunnable, min * 60_000L)
        } else sleepAt = 0L
      }
      ACTION_SLEEP_CANCEL -> {
        handler.removeCallbacks(sleepRunnable)
        sleepAt = 0L
      }
    }
    refresh()
    return START_STICKY
  }

  private fun startAsForeground() {
    createChannel()
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
      ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE else 0
    try {
      ServiceCompat.startForeground(this, NOTIF_ID, build(), type)
    } catch (e: Exception) {
      // sem permissão de Bluetooth/notificação: encerra para não derrubar o app
      stopSelf()
    }
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java)
    if (nm.getNotificationChannel(CHANNEL) == null) {
      val ch = NotificationChannel(CHANNEL, "Controle do projetor", NotificationManager.IMPORTANCE_LOW)
      ch.setShowBadge(false)
      nm.createNotificationChannel(ch)
    }
  }

  private fun pi(action: String, code: Int): PendingIntent {
    val i = Intent(this, ControlService::class.java).setAction(action)
    return PendingIntent.getService(this, code, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun build(): Notification {
    val name = try { HidController.connected?.name } catch (e: Exception) { null }
    val status = when (HidController.state) {
      "connected" -> "Conectado a ${name ?: "projetor"}"
      "ready" -> "Aguardando o projetor"
      else -> "Bluetooth desconectado"
    }
    val sleep = if (sleepAt > 0) {
      val left = ((sleepAt - System.currentTimeMillis()) / 60_000L).coerceAtLeast(0) + 1
      " · desliga em $left min"
    } else ""
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val content = launch?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    return NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle("Projetor")
      .setContentText(status + sleep)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setContentIntent(content)
      .addAction(0, "Vol −", pi(ACTION_VOL_DOWN, 1))
      .addAction(0, "Play/Pausa", pi(ACTION_PLAY, 2))
      .addAction(0, "Vol +", pi(ACTION_VOL_UP, 3))
      .addAction(0, "Ligar/Desligar", pi(ACTION_POWER, 4))
      .setStyle(androidx.media.app.NotificationCompat.MediaStyle().setShowActionsInCompactView(0, 1, 2))
      .build()
  }

  private fun refresh() {
    try {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.notify(NOTIF_ID, build())
    } catch (_: Exception) {}
  }

  override fun onDestroy() {
    handler.removeCallbacks(sleepRunnable)
    HidController.listeners.remove(stateListener)
    super.onDestroy()
  }
}
