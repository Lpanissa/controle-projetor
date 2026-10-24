package com.panissa.projetor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService

/** Só existe para o Android deixar a Ponte ler o que está passando (nome da série/episódio). */
class MediaListener : NotificationListenerService()

/** Liga a Ponte sozinha quando o projetor liga. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    BridgeService.start(context)
  }
}
