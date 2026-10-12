package fans.echoes.client.ui.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import fans.echoes.client.data.api.Api
import fans.echoes.client.data.api.Story
import fans.echoes.client.data.api.userMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LibraryState(
    val loading: Boolean = true,
    val stories: List<Story> = emptyList(),
    val category: String = "All",
    val query: String = "",
    val error: String? = null,
    /** Pull-to-refresh in progress; the current list stays visible. */
    val refreshing: Boolean = false,
) {
    val categories: List<String> = CATEGORIES

    val visible: List<Story>
        get() = stories.filter { story ->
            val matchesCategory = category == "All" || story.category == category
            val q = query.trim().lowercase()
            val matchesQuery = q.isEmpty() ||
                story.title.lowercase().contains(q) ||
                story.description.lowercase().contains(q)
            matchesCategory && matchesQuery
        }

    companion object {
        val CATEGORIES = listOf(
            "All", "War", "Love", "Immigration", "Entrepreneurship", "Family", "Survival", "Other",
        )
    }
}

class LibraryViewModel : ViewModel() {

    private val _state = MutableStateFlow(LibraryState())
    val state: StateFlow<LibraryState> = _state.asStateFlow()

    init { refresh() }

    fun refresh(pulled: Boolean = false) {
        _state.update {
            if (pulled) it.copy(refreshing = true, error = null)
            else it.copy(loading = it.stories.isEmpty(), error = null)
        }
        viewModelScope.launch {
            runCatching { Api.service.stories() }
                // A feed must not die because the backend returned the same story
                // twice: LazyColumn treats a repeated key as a fatal error.
                .map { stories -> stories.distinctBy(Story::id) }
                .onSuccess { stories -> _state.update { it.copy(loading = false, refreshing = false, stories = stories) } }
                .onFailure { e -> _state.update { it.copy(loading = false, refreshing = false, error = e.userMessage()) } }
        }
    }

    fun setCategory(category: String) = _state.update { it.copy(category = category) }

    fun setQuery(query: String) = _state.update { it.copy(query = query) }
}
