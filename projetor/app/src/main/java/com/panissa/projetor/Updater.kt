package com.panissa.projetor

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Atualiza a Ponte sozinha: confere a versão no GitHub, baixa o APK novo
 * e abre a tela de instalação no projetor (só apertar "Instalar").
 */
object Updater {
  private const val TAG = "PonteUpdate"
  private const val BASE = "https://github.com/Lpanissa/controle-projetor/releases/latest/download/"
  @Volatile private var busy = false

  private fun currentVersion(ctx: Context): Long {
    val info = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
    @Suppress("DEPRECATION")
    return if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
  }

  private fun open(url: String): HttpURLConnection {
    var u = url
    repeat(6) {
      val c = URL(u).openConnection() as HttpURLConnection
      c.instanceFollowRedirects = false
      c.connectTimeout = 15000
      c.readTimeout = 60000
      val code = c.responseCode
      if (code in 300..399) {
        u = c.getHeaderField("Location") ?: return c
        c.disconnect()
      } else return c
    }
    throw IllegalStateException("redirecionamentos demais")
  }

  /** Retorna uma mensagem curta com o resultado. Roda fora da tela principal. */
  fun check(ctx: Context, showIfNone: Boolean = false): String {
    if (busy) return "Já estou atualizando"
    busy = true
    try {
      val remote = open(BASE + "ponte-version.txt").inputStream.bufferedReader().readText().trim().toLongOrNull()
        ?: return "Não consegui ver a versão nova"
      val local = currentVersion(ctx)
      if (remote <= local) return if (showIfNone) "A Ponte já está atualizada (versão $local)" else ""
      val file = File(ctx.cacheDir, "ponte-update.apk")
      open(BASE + "Projetor-Ponte.apk").inputStream.use { input ->
        file.outputStream().use { input.copyTo(it) }
      }
      val uri: Uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", file)
      val i = Intent(Intent.ACTION_VIEW)
        .setDataAndType(uri, "application/vnd.android.package-archive")
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
      ctx.startActivity(i)
      return "Versão nova baixada: aperte Instalar"
    } catch (e: Exception) {
      Log.w(TAG, "falhou", e)
      return "Não consegui atualizar agora"
    } finally {
      busy = false
    }
  }
}
