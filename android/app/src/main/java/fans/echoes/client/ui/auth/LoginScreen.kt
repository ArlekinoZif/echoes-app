package fans.echoes.client.ui.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import fans.echoes.client.R
import fans.echoes.client.ui.theme.BrandBorder
import fans.echoes.client.ui.theme.BrandError
import fans.echoes.client.ui.theme.BrandText
import fans.echoes.client.ui.theme.BrandTextFaint
import fans.echoes.client.ui.theme.BrandTextMuted
import fans.echoes.client.ui.theme.GoldButton
import fans.echoes.client.ui.theme.HoloText
import fans.echoes.client.ui.theme.SectionLabel
import fans.echoes.client.ui.theme.SpaceGrotesk

/**
 * Mirrors the landing screen of the web product: wordmark, tagline with the
 * emphasised middle sentence, the three headline figures, a divider, and the
 * primary action. The action itself differs — on a Seeker the wallet is Seed
 * Vault rather than a browser extension.
 */
@Composable
fun LoginScreen(
    state: AuthUiState,
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.fillMaxSize()) {
        // The site carries the same artwork, ghosted behind the landing copy.
        Image(
            painter = painterResource(R.drawable.brand_backdrop),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxSize()
                .alpha(0.09f),
        )
        // The site lets the artwork fade out towards the top of the screen.
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    androidx.compose.ui.graphics.Brush.verticalGradient(
                        0f to fans.echoes.client.ui.theme.BrandBackground,
                        0.45f to fans.echoes.client.ui.theme.BrandBackground.copy(alpha = 0.72f),
                        1f to fans.echoes.client.ui.theme.BrandBackground.copy(alpha = 0.35f),
                    ),
                ),
        )

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Image(
            painter = painterResource(R.drawable.brand_icon),
            contentDescription = null,
            modifier = Modifier.size(34.dp).alpha(0.9f),
        )
        Spacer(Modifier.height(18.dp))
        HoloText(
            "echoes",
            style = MaterialTheme.typography.headlineMedium.copy(
                fontSize = 44.sp,
                lineHeight = 48.sp,
                letterSpacing = (-1.6).sp,
            ),
        )
        Spacer(Modifier.height(6.dp))
        SectionLabel("Records library", color = BrandTextMuted)

        Spacer(Modifier.height(24.dp))
        Text(
            buildAnnotatedString {
                append("Record your story. ")
                withStyle(SpanStyle(color = BrandText, fontWeight = FontWeight.Bold)) {
                    append("Get listed.")
                }
                append(" Tokenize and earn from every trade - forever.")
            },
            style = MaterialTheme.typography.bodyLarge,
            color = BrandTextMuted,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(28.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            Stat("1.2K+", "Stories")
            Stat("340+", "Creators")
            Stat("$48K", "Volume")
        }

        Spacer(Modifier.height(24.dp))
        Spacer(Modifier.fillMaxWidth().height(1.dp).background(BrandBorder))
        Spacer(Modifier.height(24.dp))

        GoldButton(
            text = when {
                state.signingIn -> "Connecting…"
                fans.echoes.client.data.SeekerDevice.isSeeker -> "Sign in with Seed Vault"
                else -> "Sign in with a Solana wallet"
            },
            onClick = onSignIn,
            enabled = !state.signingIn,
            height = 52.dp,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(14.dp))
        Text(
            if (fans.echoes.client.data.SeekerDevice.isSeeker)
                "Seed Vault signs in one step on this Seeker. It is not a transaction and costs nothing — your keys never leave the phone."
            else
                "Your wallet app (Phantom, Solflare, Backpack…) signs one login message. It is not a transaction and costs nothing.",
            style = MaterialTheme.typography.bodySmall,
            color = BrandTextFaint,
            textAlign = TextAlign.Center,
        )

        if (state.walletMissing) {
            Spacer(Modifier.height(18.dp))
            Text(
                "No compatible wallet found on this device. Seed Vault is built into a Seeker; elsewhere install a Mobile Wallet Adapter wallet first.",
                style = MaterialTheme.typography.bodySmall,
                color = BrandError,
                textAlign = TextAlign.Center,
            )
        }
        state.error?.let { message ->
            Spacer(Modifier.height(18.dp))
            Text(
                message,
                style = MaterialTheme.typography.bodySmall,
                color = BrandError,
                textAlign = TextAlign.Center,
            )
        }
    }
    }
}

@Composable
private fun Stat(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            value,
            style = MaterialTheme.typography.titleMedium.copy(
                fontFamily = SpaceGrotesk,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
            ),
            color = BrandText,
        )
        SectionLabel(label)
    }
}
