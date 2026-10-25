package com.panissa.projetor

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.wifi.WifiManager
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

/** Tela da Ponte no projetor: mostra o IP e libera a leitura do que está passando. */
class MainActivity : Activity() {
  private lateinit var status: TextView
  private lateinit var mediaBtn: Button

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    BridgeService.start(this)

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#0b0d10"))
      setPadding(80, 60, 80, 60)
    }
    root.addView(TextView(this).apply {
      text = "Projetor Ponte"
      textSize = 34f
      setTypeface(typeface, Typeface.BOLD)
      setTextColor(Color.parseColor("#e9edf2"))
      gravity = Gravity.CENTER
    })
    status = TextView(this).apply {
      textSize = 20f
      setTextColor(Color.parseColor("#8a93a0"))
      gravity = Gravity.CENTER
      setPadding(0, 30, 0, 40)
    }
    root.addView(status)

    root.addView(button("Deixar visível no Bluetooth (2 min)") {
      if (!makeDiscoverable(this)) Toast.makeText(this, "O projetor não deixou ficar visível.", Toast.LENGTH_LONG).show()
    })
    mediaBtn = button("Permitir mostrar o que está passando") { openNotificationAccess() }
    root.addView(mediaBtn)
    root.addView(button("Fechar (a Ponte continua ligada)") { finish() })
    setContentView(root)
    mediaBtn.requestFocus()
  }

  override fun onResume() {
    super.onResume()
    val ip = ipAddress()
    val media = hasNotificationAccess()
    status.text = "Endereço: $ip\n\nNo celular, abra o Controle do Projetor → Ajustes → Procurar o projetor." +
      if (media) "\n\nLeitura do que está passando: ligada" else ""
    mediaBtn.visibility = if (media) View.GONE else View.VISIBLE
  }

  private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
    text = label
    textSize = 18f
    isAllCaps = false
    setTextColor(Color.parseColor("#e9edf2"))
    background = GradientDrawable().apply {
      cornerRadius = 24f
      setColor(Color.parseColor("#15181d"))
      setStroke(3, Color.parseColor("#262b33"))
    }
    setOnFocusChangeListener { v, has ->
      (v.background as GradientDrawable).setStroke(4, Color.parseColor(if (has) "#4f8cff" else "#262b33"))
    }
    setOnClickListener { onClick() }
    layoutParams = LinearLayout.LayoutParams(900, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = 20 }
    setPadding(30, 28, 30, 28)
  }

  private fun hasNotificationAccess(): Boolean {
    val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners") ?: return false
    val me = ComponentName(this, MediaListener::class.java).flattenToString()
    return flat.split(":").any { it == me }
  }

  private fun openNotificationAccess() {
    try {
      startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"))
    } catch (e: Exception) {
      Toast.makeText(
        this,
        "Este projetor esconde essa tela. Abra o Activity Launcher e busque \"notification\".",
        Toast.LENGTH_LONG
      ).show()
    }
  }

  @Suppress("DEPRECATION")
  private fun ipAddress(): String {
    val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    val ip = wm.connectionInfo?.ipAddress ?: 0
    if (ip == 0) return "sem Wi-Fi"
    return "${ip and 0xff}.${ip shr 8 and 0xff}.${ip shr 16 and 0xff}.${ip shr 24 and 0xff}"
  }
}
