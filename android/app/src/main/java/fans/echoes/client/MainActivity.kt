package fans.echoes.client

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import fans.echoes.client.data.StoryLinks
import fans.echoes.client.data.api.Api
import fans.echoes.client.data.repo.PoolRepository
import fans.echoes.client.playback.PlaybackController
import fans.echoes.client.ui.auth.AuthUiState
import fans.echoes.client.ui.auth.AuthViewModel
import fans.echoes.client.ui.auth.LoginScreen
import fans.echoes.client.ui.AppScaffold
import fans.echoes.client.ui.theme.Backdrop
import fans.echoes.client.ui.theme.BrandGold
import fans.echoes.client.ui.theme.EchoesBackdrop
import androidx.compose.runtime.remember
import fans.echoes.client.ui.theme.EchoesTheme

class MainActivity : ComponentActivity() {

    private val auth: AuthViewModel by viewModels()

    /** Must be created before the activity starts, so the wallet can return here. */
    private lateinit var walletSender: ActivityResultSender

    /**
     * Story requested by an incoming recording link. Held until the person is
     * signed in, then consumed by the scaffold, so a link opened from a cold
     * start still lands on the story after sign-in.
     */
    private var pendingStoryId by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        Api.init(applicationContext)
        fans.echoes.client.data.auth.WalletAuth.init(applicationContext)
        PlaybackController.connect(applicationContext)
        PoolRepository.init(applicationContext)
        walletSender = ActivityResultSender(this)

        if (savedInstanceState == null) pendingStoryId = StoryLinks.storyId(intent?.data)

        splash.setKeepOnScreenCondition { auth.state.value.checking }

        setContent {
            val state by auth.state.collectAsStateWithLifecycle()
            var backdrop by remember { mutableStateOf(Backdrop.Library) }
            EchoesApp(
                state = state,
                walletSender = walletSender,
                onSignIn = { auth.signIn(walletSender) },
                onSignOut = auth::signOut,
                openStoryId = pendingStoryId,
                onStoryOpened = { pendingStoryId = null },
                backdrop = backdrop,
                onBackdrop = { backdrop = it },
            )
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        StoryLinks.storyId(intent.data)?.let { pendingStoryId = it }
    }
}

@Composable
private fun EchoesApp(
    state: AuthUiState,
    walletSender: ActivityResultSender,
    onSignIn: () -> Unit,
    onSignOut: () -> Unit,
    openStoryId: String?,
    onStoryOpened: () -> Unit,
    backdrop: Backdrop,
    onBackdrop: (Backdrop) -> Unit,
) {
    EchoesTheme {
        val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
        Surface(
            modifier = Modifier
                .fillMaxSize()
                // A tap on empty space closes the keyboard, as people expect;
                // buttons and fields consume their own taps first.
                // Only taps nothing else claimed: a text field or button handles its
                // own tap (and keeps focus) — the first version cleared focus on
                // every tap, so text fields could not be typed into at all.
                .pointerInput(Unit) {
                    awaitEachGesture {
                        awaitFirstDown(requireUnconsumed = false, pass = androidx.compose.ui.input.pointer.PointerEventPass.Final)
                        val up = waitForUpOrCancellation(pass = androidx.compose.ui.input.pointer.PointerEventPass.Final)
                        if (up != null && !up.isConsumed) focusManager.clearFocus()
                    }
                },
        ) {
            // The living background sits behind everything once signed in; the
            // login screen keeps its own photographic backdrop.
            if (state.signedIn) EchoesBackdrop(backdrop)
            val insets = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars)
            when {
                state.checking -> Box(insets, Alignment.Center) {
                    CircularProgressIndicator(color = BrandGold)
                }

                !state.signedIn -> LoginScreen(
                    state = state,
                    onSignIn = onSignIn,
                    modifier = insets,
                )

                else -> AppScaffold(
                    ownerId = state.address.orEmpty(),
                    walletSender = walletSender,
                    onSignOut = onSignOut,
                    openStoryId = openStoryId,
                    onStoryOpened = onStoryOpened,
                    onBackdrop = onBackdrop,
                    modifier = insets,
                )
            }
        }
    }
}
