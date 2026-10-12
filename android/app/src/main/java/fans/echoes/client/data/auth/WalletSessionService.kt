package fans.echoes.client.data.auth

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import fans.echoes.client.R
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Keeps Echoes running while the wallet is on screen.
 *
 * Mobile Wallet Adapter talks to the wallet over a local WebSocket owned by this
 * process. As soon as the wallet takes the screen, Echoes becomes a background
 * app, and Android 14+ freezes background apps after a few seconds. A frozen
 * process cannot read the wallet's answer, so anyone who takes longer than that
 * to press Connect or Sign was left with a wallet waiting forever — found on a
 * Pixel with Phantom, invisible on the emulator.
 *
 * A short foreground service for the length of the wallet exchange is the
 * platform's intended way to stay responsive; it shows a quiet notification.
 */
class WalletSessionService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification()
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        }.onFailure { stopSelf() }
        started.complete(Unit)
        return START_NOT_STICKY
    }

    /** A short service is given about three minutes; past that the exchange has failed anyway. */
    override fun onTimeout(startId: Int) {
        stopSelf()
    }

    private fun buildNotification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Wallet requests", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Shown while your wallet is asked to sign in or approve a payment."
                    setShowBadge(false)
                },
            )
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_echoes)
            .setContentTitle("Waiting for your wallet…")
            .setContentText("Approve the request in your wallet to continue.")
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "wallet-session"
        private const val NOTIFICATION_ID = 7310

        /**
         * Runs [block] with the process held awake. Starting is best-effort: if the
         * system refuses (for example the app is already in the background) the
         * exchange still runs, exactly as it did before this service existed.
         */
        suspend fun <T> hold(context: Context, block: suspend () -> T): T {
            val intent = Intent(context, WalletSessionService::class.java)
            val signal = CompletableDeferred<Unit>().also { started = it }
            val launched = runCatching { ContextCompat.startForegroundService(context, intent) }.isSuccess
            try {
                return block()
            } finally {
                // Stopping a foreground service before it has called startForeground
                // crashes the app on some Android versions, so wait for it to start
                // (it does so immediately) before stopping it.
                if (launched) {
                    withContext(NonCancellable) {
                        withTimeoutOrNull(4_000) { signal.await() }
                        runCatching { context.stopService(intent) }
                    }
                }
            }
        }

        @Volatile
        private var started = CompletableDeferred<Unit>()
    }
}
