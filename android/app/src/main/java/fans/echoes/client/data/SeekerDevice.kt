package fans.echoes.client.data

import android.content.Context
import android.os.Build
import android.provider.Settings
import fans.echoes.client.data.api.DeviceInfo

/**
 * What the app knows about the phone it runs on.
 *
 * Seeker detection follows Solana Mobile's guidance: `Build.MODEL == "Seeker"`.
 * That check can be spoofed on a modified device, so it only changes wording and
 * presentation; anything that grants something is decided by the server's
 * Seeker Genesis Token check instead.
 */
object SeekerDevice {

    val isSeeker: Boolean = Build.MODEL.equals("Seeker", ignoreCase = true)

    /** The name shown in the Devices list: the one the owner gave the phone, else its model. */
    fun info(context: Context): DeviceInfo {
        val named = runCatching {
            Settings.Global.getString(context.contentResolver, Settings.Global.DEVICE_NAME)
        }.getOrNull()?.takeIf { it.isNotBlank() }
        val model = listOf(Build.MANUFACTURER.replaceFirstChar { it.uppercase() }, Build.MODEL)
            .distinct()
            .joinToString(" ")
            .let { if (it.contains(Build.MANUFACTURER, ignoreCase = true) && Build.MODEL.startsWith(Build.MANUFACTURER, ignoreCase = true)) Build.MODEL else it }
        val name = when {
            named == null -> model
            named.equals(model, ignoreCase = true) || named == Build.MODEL -> model
            else -> "$named · $model"
        }
        return DeviceInfo(name = name, platform = "Android ${Build.VERSION.RELEASE}", seeker = isSeeker)
    }
}
