package fans.echoes.client.ui.pool

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import fans.echoes.client.data.api.PoolState
import fans.echoes.client.data.api.userMessage
import fans.echoes.client.data.repo.PoolRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PoolUiState(
    val loading: Boolean = true,
    val pool: PoolState? = null,
    val selectedStoryId: String? = null,
    val votedStoryId: String? = null,
    val working: Boolean = false,
    val revealed: Boolean = false,
    val error: String? = null,
    val unavailable: Boolean = false,
    /** Pull-to-refresh in progress (the list stays on screen meanwhile). */
    val refreshing: Boolean = false,
    /** Story id → cover URL, borrowed from the library so pool cards have art. */
    val covers: Map<String, String?> = emptyMap(),
)

class PoolViewModel : ViewModel() {

    private val _state = MutableStateFlow(PoolUiState())
    val state: StateFlow<PoolUiState> = _state.asStateFlow()

    fun refresh(voter: String) = load(voter, pulled = true)

    fun load(voter: String, pulled: Boolean = false) {
        _state.update {
            if (pulled) it.copy(refreshing = true, error = null)
            else it.copy(loading = it.pool == null, error = null, unavailable = false)
        }
        viewModelScope.launch {
            launch {
                runCatching { fans.echoes.client.data.api.Api.service.stories() }
                    .onSuccess { stories -> _state.update { s -> s.copy(covers = stories.associate { it.id to it.coverImageUrl }) } }
            }
            runCatching { PoolRepository.pool() }
                .map { pool -> pool.copy(entries = pool.entries.distinctBy { entry -> entry.storyId }) }
                .onSuccess { pool ->
                    val stored = PoolRepository.storedVote(pool.poolId, voter)
                    _state.update {
                        it.copy(loading = false, refreshing = false, pool = pool, votedStoryId = stored?.first)
                    }
                }
                .onFailure { e ->
                    // 503 means the operator has the weekly pool switched off.
                    val off = (e as? retrofit2.HttpException)?.code() == 503
                    _state.update {
                        it.copy(loading = false, refreshing = false, unavailable = off, error = if (off) null else e.userMessage())
                    }
                }
        }
    }

    fun select(storyId: String) = _state.update { it.copy(selectedStoryId = storyId) }

    fun vote(voter: String) {
        val pool = _state.value.pool ?: return
        val storyId = _state.value.selectedStoryId ?: return
        if (_state.value.working) return
        _state.update { it.copy(working = true, error = null) }
        viewModelScope.launch {
            runCatching {
                PoolRepository.vote(
                    poolId = pool.poolId,
                    voter = voter,
                    storyId = storyId,
                    echoesAmount = pool.echoesVoteCost.takeIf { it > 0 } ?: 1.0,
                )
            }.onSuccess {
                _state.update { it.copy(working = false, votedStoryId = storyId) }
            }.onFailure { e ->
                _state.update { it.copy(working = false, error = e.userMessage()) }
            }
        }
    }

    fun reveal(voter: String) {
        val pool = _state.value.pool ?: return
        if (_state.value.working) return
        _state.update { it.copy(working = true, error = null) }
        viewModelScope.launch {
            runCatching { PoolRepository.reveal(pool.poolId, voter) }
                .onSuccess { _state.update { it.copy(working = false, revealed = true) } }
                .onFailure { e -> _state.update { it.copy(working = false, error = e.userMessage()) } }
        }
    }
}
