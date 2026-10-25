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

/** Deixa o projetor visível no Bluetooth por 2 minutos (para o celular achar e parear). */
fun makeDiscoverable(ctx: Context): Boolean = try {
  val i = Intent(android.bluetooth.BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE)
    .putExtra(android.bluetooth.BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 120)
    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  ctx.startActivity(i)
  true
} catch (e: Exception) {
  false
}
