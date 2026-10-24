package expo.modules.projectornative

import android.content.Context
import android.hardware.ConsumerIrManager

/** Infravermelho do celular (Xiaomi tem). Usa o padrão NEC, o mais comum em projetores chineses. */
object IrController {
  private const val PREFS = "projetor_prefs"

  fun manager(ctx: Context): ConsumerIrManager? =
    ctx.getSystemService(Context.CONSUMER_IR_SERVICE) as? ConsumerIrManager

  fun hasIr(ctx: Context): Boolean = manager(ctx)?.hasIrEmitter() == true

  fun transmit(ctx: Context, frequency: Int, pattern: IntArray): Boolean {
    val m = manager(ctx) ?: return false
    if (!m.hasIrEmitter()) return false
    return try { m.transmit(frequency, pattern); true } catch (e: Exception) { false }
  }

  /** Monta o sinal NEC. address > 0xFF vira NEC estendido (16 bits). */
  fun necPattern(address: Int, command: Int): IntArray {
    val out = ArrayList<Int>()
    out.add(9000); out.add(4500)
    val bytes = if (address > 0xFF) {
      intArrayOf(address and 0xFF, (address shr 8) and 0xFF, command and 0xFF, command.inv() and 0xFF)
    } else {
      intArrayOf(address and 0xFF, address.inv() and 0xFF, command and 0xFF, command.inv() and 0xFF)
    }
    for (b in bytes) {
      for (i in 0 until 8) {
        out.add(562)
        out.add(if ((b shr i) and 1 == 1) 1687 else 562)
      }
    }
    out.add(562)
    return out.toIntArray()
  }

  fun sendNec(ctx: Context, address: Int, command: Int): Boolean =
    transmit(ctx, 38000, necPattern(address, command))

  // ----- código do botão de ligar salvo -----
  fun savePower(ctx: Context, address: Int, command: Int) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putInt("ir_addr", address).putInt("ir_cmd", command).apply()
  }

  fun sendPower(ctx: Context): Boolean {
    val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    if (!p.contains("ir_cmd")) return false
    return sendNec(ctx, p.getInt("ir_addr", 0), p.getInt("ir_cmd", 0))
  }

  fun hasPowerCode(ctx: Context): Boolean =
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).contains("ir_cmd")
}
