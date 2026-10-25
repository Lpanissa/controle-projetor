package com.panissa.projetor

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * O projetor procura o celular pelo nome e pede o pareamento.
 * (A tela de "Acessório" da fábrica só mostra controles e esconde celulares.)
 */
@SuppressLint("MissingPermission")
object Pairer {
  fun hasLocation(ctx: Context): Boolean =
    Build.VERSION.SDK_INT < 23 ||
      ctx.checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

  fun pair(ctx: Context, phoneName: String): JSONObject {
    val res = JSONObject()
    val adapter = BluetoothAdapter.getDefaultAdapter() ?: return res.put("ok", false).put("msg", "Projetor sem Bluetooth")
    res.put("projectorName", adapter.name ?: "")
    if (!adapter.isEnabled) adapter.enable()
    if (!hasLocation(ctx)) {
      return res.put("ok", false).put("msg", "Abra a Projetor Ponte no projetor e permita a localização")
    }
    // já pareado?
    adapter.bondedDevices.firstOrNull { it.name == phoneName }?.let {
      return res.put("ok", true).put("msg", "Já pareado")
    }
    var found: BluetoothDevice? = null
    val latch = CountDownLatch(1)
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(c: Context, i: Intent) {
        if (i.action != BluetoothDevice.ACTION_FOUND) return
        val d: BluetoothDevice = i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE) ?: return
        val n = d.name ?: i.getStringExtra(BluetoothDevice.EXTRA_NAME)
        if (n != null && n.trim().equals(phoneName.trim(), ignoreCase = true)) {
          found = d
          latch.countDown()
        }
      }
    }
    ctx.registerReceiver(receiver, IntentFilter(BluetoothDevice.ACTION_FOUND))
    try {
      adapter.cancelDiscovery()
      adapter.startDiscovery()
      latch.await(25, TimeUnit.SECONDS)
    } finally {
      adapter.cancelDiscovery()
      try { ctx.unregisterReceiver(receiver) } catch (_: Exception) {}
    }
    val dev = found ?: return res.put("ok", false).put("msg", "Não achei o celular. Deixe o Bluetooth do celular visível e tente de novo.")
    val started = dev.createBond()
    return res.put("ok", started).put("msg", if (started) "Confirme o pareamento no celular" else "O pareamento não começou")
  }
}
