package fans.echoes.client.ui.legal

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import fans.echoes.client.ui.theme.BrandTextFaint
import fans.echoes.client.ui.theme.BrandTextMuted
import fans.echoes.client.ui.theme.HoloText
import fans.echoes.client.ui.theme.SectionLabel

/**
 * The privacy policy, carried in the app rather than only on the web, because a
 * store reviewer has to reach it without leaving the app. The wording matches
 * the policy the site serves at /privacy.
 */
@Composable
fun PrivacyScreen(onBack: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        IconButton(onClick = onBack, modifier = Modifier.padding(start = 4.dp, top = 4.dp)) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = BrandTextMuted)
        }

        Column(Modifier.padding(horizontal = 20.dp)) {
            HoloText("privacy")
            SectionLabel("Last updated 20 September 2026")
            Spacer(Modifier.height(20.dp))

            Section(
                "What we collect",
                "Your wallet address, which identifies the account. Signing in proves you " +
                    "control it; Echoes never receives your seed phrase or private keys — on a " +
                    "Seeker they stay inside Seed Vault.\n\n" +
                    "Anything you choose to enter: age, country, languages and social handle. " +
                    "Age, country and language are shown publicly so listeners can find stories " +
                    "by audience.\n\n" +
                    "Recordings you publish, with their title, description, category and length; " +
                    "your reviews, favourites, reports, referral code and pool votes; and the " +
                    "signatures of on-chain payments for listing or unlocking a story.",
            )
            Section(
                "Microphone",
                "The microphone is used only while you are recording, and only after Android " +
                    "asks your permission. Audio is uploaded when you choose to publish. Nothing " +
                    "is captured in the background.",
            )
            Section(
                "Where it is stored",
                "Story metadata and activity live in a managed Postgres database in the EU. " +
                    "Audio and images live in object storage; audio for a private story is served " +
                    "only through an authenticated proxy after payment is verified on-chain.\n\n" +
                    "Anything published to the Solana blockchain — a token launch, a listing " +
                    "payment, a vote — is public and permanent by the nature of a blockchain and " +
                    "cannot be deleted by us or by you.",
            )
            Section(
                "Who else sees it",
                "We do not sell personal data and do not share it for advertising. Data reaches " +
                    "service providers only to make a feature work: wallet and RPC infrastructure, " +
                    "token launches and trading quotes, optional voice enhancement of a recording " +
                    "you submit, storage, and permanent archival when you ask for it.\n\n" +
                    "Published stories and the public profile fields above are visible to everyone.",
            )
            Section(
                "Deleting your account",
                "Open Zone and choose Delete account. That erases your profile, favourites, " +
                    "reviews, reports and unlock records, and deletes the recordings you own.\n\n" +
                    "One exception: a recording already tokenised exists on-chain and cannot be " +
                    "withdrawn, so its personal identifiers are stripped instead. Blockchain " +
                    "transactions themselves remain public.",
            )
            Section(
                "Reporting content",
                "Every published story carries a Report action. Reports are reviewed and content " +
                    "that breaks the rules is removed. Reporting requires being signed in so one " +
                    "account cannot flood the queue.",
            )
            Section(
                "Children",
                "Echoes is not directed at children under 13 and we do not knowingly collect " +
                    "their data. Write to privacy@echoes.fans and we will erase it.",
            )
            Section(
                "Contact",
                "Questions about this policy, or about the data held about you, go to " +
                    "privacy@echoes.fans.",
            )
            Spacer(Modifier.height(40.dp))
        }
    }
}

@Composable
private fun Section(title: String, body: String) {
    Column(Modifier.padding(bottom = 22.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(6.dp))
        Text(body, style = MaterialTheme.typography.bodyMedium, color = BrandTextMuted)
    }
}

@Suppress("unused")
private val note = BrandTextFaint
