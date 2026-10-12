package fans.echoes.client.ui.profile

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.PrivacyTip
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import fans.echoes.client.BuildConfig
import fans.echoes.client.ui.theme.BrandBorder
import fans.echoes.client.ui.theme.BrandError
import fans.echoes.client.ui.theme.BrandGold
import fans.echoes.client.ui.theme.BrandGoldDim
import fans.echoes.client.ui.theme.BrandPanel
import fans.echoes.client.ui.theme.BrandRadius
import fans.echoes.client.ui.theme.BrandSurface
import fans.echoes.client.ui.theme.BrandText
import fans.echoes.client.ui.theme.BrandTextFaint
import fans.echoes.client.ui.theme.BrandTextMuted
import fans.echoes.client.ui.theme.DefaultVinylLabel
import fans.echoes.client.ui.theme.GlassCard
import fans.echoes.client.ui.theme.GoldButton
import fans.echoes.client.ui.theme.HoloText
import fans.echoes.client.ui.theme.ScreenPadding
import fans.echoes.client.ui.theme.SectionLabel
import fans.echoes.client.ui.theme.VinylDisc
import fans.echoes.client.ui.theme.brandFieldColors
import fans.echoes.client.ui.theme.rememberVinylSpin
import fans.echoes.client.ui.theme.spinnable

/**
 * The person's corner of the app: who they are, their invite code, the profile
 * listeners see, and the settings and data controls the store policy requires.
 *
 * Each card is its own lazy item on purpose: a single item taller than the
 * viewport keeps drawing correctly after a scroll but stops receiving taps.
 */
@Composable
fun ProfileScreen(
    wallet: String,
    onSignOut: () -> Unit,
    onOpenPrivacy: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ProfileViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    var copied by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(wallet) { viewModel.load(wallet) }
    LaunchedEffect(copied) {
        if (copied != null) {
            kotlinx.coroutines.delay(1600)
            copied = null
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = ScreenPadding, end = ScreenPadding, top = 20.dp, bottom = 40.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            HoloText("your zone")
            SectionLabel("Profile · Invites · Settings")
        }

        item {
            IdentityCard(
                wallet = wallet,
                copied = copied == "wallet",
                onCopy = {
                    clipboard.setText(AnnotatedString(wallet))
                    copied = "wallet"
                },
            )
        }

        if (state.loading) {
            item {
                Row(Modifier.fillMaxWidth().padding(top = 30.dp), Arrangement.Center) {
                    CircularProgressIndicator(color = BrandGold)
                }
            }
            return@LazyColumn
        }

        item {
            val code = state.referralCode
            val link = code?.let { "https://echoes.fans?ref=$it" }
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                SectionLabel("Invite friends")
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            code ?: "—",
                            style = MaterialTheme.typography.headlineSmall.copy(letterSpacing = MaterialTheme.typography.labelMedium.letterSpacing),
                            color = BrandGold,
                        )
                        Text("your code", style = MaterialTheme.typography.bodySmall, color = BrandTextMuted)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("${state.referralCount}", style = MaterialTheme.typography.headlineSmall, color = BrandText)
                        Text("joined", style = MaterialTheme.typography.bodySmall, color = BrandTextMuted)
                    }
                }
                if (link != null) {
                    Spacer(Modifier.height(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PillAction(
                            icon = Icons.Filled.ContentCopy,
                            text = if (copied == "link") "Copied" else "Copy link",
                            modifier = Modifier.weight(1f),
                        ) {
                            clipboard.setText(AnnotatedString(link))
                            copied = "link"
                        }
                        PillAction(icon = Icons.Filled.Share, text = "Share", modifier = Modifier.weight(1f)) {
                            val send = Intent(Intent.ACTION_SEND)
                                .setType("text/plain")
                                .putExtra(Intent.EXTRA_TEXT, "Record your story on Echoes: $link")
                            context.startActivity(Intent.createChooser(send, null))
                        }
                    }
                } else {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Your code is created the first time this screen opens.",
                        style = MaterialTheme.typography.bodySmall,
                        color = BrandTextMuted,
                    )
                }
            }
        }

        item {
            AboutYouCard(
                state = state,
                onAge = viewModel::setAge,
                onGender = viewModel::setGender,
                onStatus = viewModel::setStatus,
                onCountry = viewModel::setCountry,
                onToggleLanguage = viewModel::toggleLanguage,
                onLanguages = viewModel::setLanguages,
                onToggleGoal = viewModel::toggleGoal,
                onTwitter = viewModel::setTwitter,
                onNoTwitter = viewModel::setNoTwitter,
                onNext = viewModel::nextStep,
                onEdit = viewModel::editStep,
                onExpand = viewModel::setAboutExpanded,
                onSave = viewModel::save,
            )
        }

        if (fans.echoes.client.data.SeekerDevice.isSeeker || state.seekerVerified) {
            item { SeekerCard(state = state, onVerify = viewModel::verifySeeker) }
        }

        item {
            DevicesCard(state = state, onRemove = viewModel::removeDevice, onSignOutHere = onSignOut)
        }

        item {
            GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = 6.dp) {
                SectionLabel("Settings", modifier = Modifier.padding(start = 12.dp, top = 10.dp, bottom = 4.dp))
                SettingRow(Icons.Filled.PrivacyTip, "Privacy policy", "What we keep and why", onClick = onOpenPrivacy)
                RowDivider()
                SettingRow(Icons.Filled.MailOutline, "Contact support", "privacy@echoes.fans") {
                    val mail = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:privacy@echoes.fans"))
                    runCatching { context.startActivity(mail) }
                }
                RowDivider()
                SettingRow(Icons.Filled.Info, "Version", "${BuildConfig.VERSION_NAME} · Solana Seeker", chevron = false)
                RowDivider()
                SettingRow(Icons.AutoMirrored.Filled.Logout, "Sign out", "You can sign back in with your wallet", onClick = onSignOut)
            }
        }

        item {
            GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = 6.dp) {
                SectionLabel("Your data", color = BrandError.copy(alpha = 0.8f), modifier = Modifier.padding(start = 12.dp, top = 10.dp, bottom = 4.dp))
                SettingRow(
                    Icons.Filled.DeleteForever,
                    "Delete account",
                    "Erases your profile, activity and recordings",
                    tint = BrandError,
                    onClick = { viewModel.openDelete(true) },
                )
            }
        }
    }

    if (state.deleteOpen) {
        AlertDialog(
            onDismissRequest = { viewModel.openDelete(false) },
            containerColor = BrandSurface,
            title = { Text("Delete account", style = MaterialTheme.typography.titleMedium) },
            text = {
                Column {
                    Text(
                        "This erases your profile, favourites, reviews, reports and unlock " +
                            "records, and deletes the recordings you own. A recording already " +
                            "tokenised stays on-chain with its personal details stripped. " +
                            "It cannot be undone.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = BrandTextMuted,
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = state.deleteConfirm,
                        onValueChange = viewModel::setDeleteConfirm,
                        placeholder = { Text("Type DELETE", color = BrandTextFaint) },
                        singleLine = true,
                        shape = RoundedCornerShape(BrandRadius.xl),
                        colors = brandFieldColors(),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    state.error?.let {
                        Spacer(Modifier.height(8.dp))
                        Text(it, color = BrandError, style = MaterialTheme.typography.bodySmall)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.deleteAccount(onSignOut) },
                    enabled = state.deleteConfirm == "DELETE" && !state.deleting,
                ) {
                    Text(if (state.deleting) "Erasing…" else "Erase my account", color = BrandError)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.openDelete(false) }) {
                    Text("Cancel", color = BrandTextMuted)
                }
            },
        )
    }
}

/** A small record labelled with the wallet: the person's "pressing". */
@Composable
private fun IdentityCard(wallet: String, copied: Boolean, onCopy: () -> Unit) {
    val spin = rememberVinylSpin()
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            VinylDisc(spin, Modifier.size(64.dp).spinnable(spin)) {
                DefaultVinylLabel(title = "", subtitle = "")
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    if (wallet.length > 12) "${wallet.take(4)}…${wallet.takeLast(4)}" else wallet,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = BrandText,
                )
                Spacer(Modifier.height(4.dp))
                Box(
                    Modifier
                        .clip(RoundedCornerShape(BrandRadius.pill))
                        .background(BrandGoldDim)
                        .border(BorderStroke(1.dp, BrandGold.copy(alpha = 0.5f)), RoundedCornerShape(BrandRadius.pill))
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                ) {
                    Text("Signed in with wallet", style = MaterialTheme.typography.labelSmall, color = BrandGold)
                }
            }
            PillAction(icon = Icons.Filled.ContentCopy, text = if (copied) "Copied" else "Copy", onClick = onCopy)
        }
    }
}

@Composable
private fun PillAction(icon: ImageVector, text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        modifier = modifier
            .height(40.dp)
            .clip(RoundedCornerShape(BrandRadius.pill))
            .background(BrandPanel)
            .border(BorderStroke(1.dp, BrandBorder), RoundedCornerShape(BrandRadius.pill))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp),
    ) {
        Icon(icon, contentDescription = null, tint = BrandGold, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        Text(text, style = MaterialTheme.typography.labelMedium, color = BrandText)
    }
}

@Composable
private fun SettingRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    tint: Color = BrandGold,
    chevron: Boolean = true,
    onClick: (() -> Unit)? = null,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(BrandRadius.xl))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 12.dp, vertical = 12.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(BrandRadius.lg))
                .background(tint.copy(alpha = 0.1f)),
        ) { Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp)) }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = if (tint == BrandError) BrandError else BrandText)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = BrandTextMuted)
        }
        if (chevron && onClick != null) {
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = BrandTextFaint)
        }
    }
}

@Composable
private fun RowDivider() {
    HorizontalDivider(color = BrandBorder, thickness = 1.dp, modifier = Modifier.padding(start = 62.dp, end = 12.dp))
}

@Composable
private fun ProfileField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    keyboard: KeyboardType = KeyboardType.Text,
    prefix: String? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        prefix = prefix?.let { { Text(it, color = BrandTextMuted) } },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        shape = RoundedCornerShape(BrandRadius.xl),
        colors = brandFieldColors(),
        modifier = modifier.padding(bottom = 10.dp),
    )
}
