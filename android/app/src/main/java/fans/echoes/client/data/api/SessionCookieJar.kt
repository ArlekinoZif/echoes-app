package fans.echoes.client.data.api

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

/**
 * Keeps the server's HttpOnly session cookie across app restarts.
 *
 * The API authenticates with a cookie rather than a bearer token, so the client
 * behaves like a browser: it stores what the server sets, respects path and
 * expiry, and sends nothing to other hosts. The store is encrypted because the
 * cookie is a bearer credential for the account.
 */
class SessionCookieJar(context: Context) : CookieJar {

    private val prefs: SharedPreferences = runCatching {
        EncryptedSharedPreferences.create(
            context,
            "echoes-session",
            MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }.getOrElse {
        // A device without a usable keystore still has to run; the cookie then
        // lives in normal app-private storage.
        context.getSharedPreferences("echoes-session-plain", Context.MODE_PRIVATE)
    }

    private val cookies = mutableMapOf<String, Cookie>()

    init {
        val url = HttpUrl.Builder().scheme("https").host(ApiConfig.host).build()
        prefs.all.values.filterIsInstance<String>().forEach { raw ->
            Cookie.parse(url, raw)?.let { cookies[key(it)] = it }
        }
    }

    private fun key(cookie: Cookie) = "${cookie.name}|${cookie.path}"

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val editor = prefs.edit()
        for (cookie in cookies) {
            val id = key(cookie)
            val expired = cookie.expiresAt <= System.currentTimeMillis()
            if (expired || cookie.value.isEmpty()) {
                this.cookies.remove(id)
                editor.remove(id)
            } else {
                this.cookies[id] = cookie
                editor.putString(id, cookie.toString())
            }
        }
        editor.apply()
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        val expired = cookies.values.filter { it.expiresAt <= now }
        if (expired.isNotEmpty()) {
            val editor = prefs.edit()
            expired.forEach { cookies.remove(key(it)); editor.remove(key(it)) }
            editor.apply()
        }
        return cookies.values.filter { it.matches(url) }
    }

    @Synchronized
    fun clear() {
        cookies.clear()
        prefs.edit().clear().apply()
    }

    @Synchronized
    fun hasSession(): Boolean = cookies.values.any { it.name == SESSION_COOKIE_NAME }

    companion object {
        const val SESSION_COOKIE_NAME = "echoes-session"
    }
}
