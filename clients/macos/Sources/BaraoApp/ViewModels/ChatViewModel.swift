import Foundation
import SwiftUI
import Combine

@MainActor
public final class ChatViewModel: ObservableObject {
    @Published public var threads: [ChatThread] = []
    @Published public var selectedSessionId: String? = nil
    @Published public var messages: [ChatMessage] = []
    @Published public var inputText: String = ""
    @Published public var isSending: Bool = false
    @Published public var isRecording: Bool = false
    @Published public var isDictating: Bool = false
    @Published public var hasMoreHistory: Bool = false
    @Published public var isLoadingMore: Bool = false
    @Published public var isLoadingThreads: Bool = false
    @Published public var isLoadingMessages: Bool = false
    @Published public var currentHistoryLimit: Int = 25
    @Published public var audioLevel: Float = 0.0
    @Published public var errorMessage: String? = nil
    @Published public var showErrorAlert: Bool = false
    @Published public var isConnected: Bool = false
    @Published public var isCheckingConnection: Bool = false
    @Published public var assistantName: String = AppConstants.appName

    public var canSendMessages: Bool {
        guard let id = selectedSessionId else { return true }
        return threads.first(where: { $0.sessionId == id })?.isActive ?? true
    }

    public var selectedThread: ChatThread? {
        guard let id = selectedSessionId else { return nil }
        return threads.first(where: { $0.sessionId == id })
    }

    private let apiClient: ApiClientProtocol
    private let storage: StorageServiceProtocol
    private let audioRecorder: AudioRecordingProtocol
    private let audioPlayback: AudioPlaybackProtocol
    private let liveSpeech: LiveSpeechRecognitionProtocol
    private var cancellables = Set<AnyCancellable>()

    public init(
        apiClient: ApiClientProtocol = ApiClientService.shared,
        storage: StorageServiceProtocol = KeychainStorageService.shared,
        audioRecorder: AudioRecordingProtocol = AudioRecordingService.shared,
        audioPlayback: AudioPlaybackProtocol = AudioPlaybackService.shared,
        liveSpeech: LiveSpeechRecognitionProtocol = LiveSpeechRecognitionService.shared
    ) {
        self.apiClient = apiClient
        self.storage = storage
        self.audioRecorder = audioRecorder
        self.audioPlayback = audioPlayback
        self.liveSpeech = liveSpeech

        setupBindings()
    }

    private func setupBindings() {
        audioRecorder.audioLevelPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] level in
                self?.audioLevel = level
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: NSNotification.Name("BaraoMessageFromSiri"))
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                if let info = notification.userInfo,
                   let prompt = info["prompt"] as? String,
                   let reply = info["reply"] as? String {
                    let userMsg = ChatMessage(role: .user, text: prompt)
                    let asstMsg = ChatMessage(role: .assistant, text: reply)
                    self?.messages.append(userMsg)
                    self?.messages.append(asstMsg)
                }
            }
            .store(in: &cancellables)
    }

    public func onAppear() {
        let config = storage.loadConfig()
        assistantName = config.assistantName
        Task {
            await checkConnection()
            await loadThreads()
        }
    }

    public func checkConnection() async {
        let config = storage.loadConfig()
        guard config.isValid else {
            isConnected = false
            return
        }

        isCheckingConnection = true
        do {
            isConnected = try await apiClient.verifyConnection(config: config)
        } catch {
            isConnected = false
        }
        isCheckingConnection = false
    }

    public func loadThreads() async {
        let config = storage.loadConfig()
        guard config.isValid else { return }

        isLoadingThreads = true
        do {
            let list = try await apiClient.fetchThreads(config: config, limit: 50)
            threads = list
            selectedSessionId = ThreadSelectionResolver.resolve(current: selectedSessionId, in: list)
            await loadHistory(sessionId: selectedSessionId)
        } catch {
            threads = []
        }
        isLoadingThreads = false
    }

    /// Applies authoritative session id from server, then refreshes thread list and history.
    private func syncAfterServerTurn(sessionId: String?) async {
        selectedSessionId = ConversationSessionSync.preferredSessionId(
            from: sessionId,
            current: selectedSessionId
        )
        await loadThreads()
    }

    public func selectThread(_ sessionId: String) {
        guard selectedSessionId != sessionId else { return }
        selectedSessionId = sessionId
        Task {
            await loadHistory(sessionId: sessionId)
        }
    }

    public func refreshAll() {
        Task {
            await loadThreads()
        }
    }

    public func loadHistory(sessionId: String? = nil) async {
        let config = storage.loadConfig()
        guard config.isValid else { return }

        let targetSession = sessionId ?? selectedSessionId
        isLoadingMessages = true
        currentHistoryLimit = 25
        do {
            let history = try await apiClient.fetchHistory(
                config: config,
                limit: currentHistoryLimit,
                sessionId: targetSession
            )
            messages = history
            hasMoreHistory = history.count >= currentHistoryLimit
        } catch {
            messages = []
            hasMoreHistory = false
        }
        isLoadingMessages = false
    }

    public func loadMoreHistory() {
        guard !isLoadingMore, hasMoreHistory else { return }
        let config = storage.loadConfig()
        guard config.isValid else { return }

        isLoadingMore = true
        let nextLimit = currentHistoryLimit + 25

        Task {
            do {
                let history = try await apiClient.fetchHistory(
                    config: config,
                    limit: nextLimit,
                    sessionId: selectedSessionId
                )
                if history.count > messages.count {
                    messages = history
                    currentHistoryLimit = nextLimit
                    hasMoreHistory = history.count >= nextLimit
                } else {
                    hasMoreHistory = false
                }
            } catch {
                hasMoreHistory = false
            }
            isLoadingMore = false
        }
    }

    public func sendMessage() {
        let prompt = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty, !isSending, canSendMessages else { return }

        let config = storage.loadConfig()
        guard config.isValid else {
            errorMessage = "Configure a URL do servidor e a Chave de API nas Configurações."
            showErrorAlert = true
            return
        }

        inputText = ""
        let userMessage = ChatMessage(role: .user, text: prompt)
        messages.append(userMessage)

        let pendingAssistantMessage = ChatMessage(role: .assistant, text: "Pensando...", isSending: true)
        messages.append(pendingAssistantMessage)
        isSending = true

        Task {
            do {
                let response = try await apiClient.sendPrompt(prompt, config: config, sessionId: selectedSessionId)
                let reply = response.reply ?? "Sem resposta."

                if let index = messages.firstIndex(where: { $0.id == pendingAssistantMessage.id }) {
                    messages[index].text = reply
                    messages[index].isSending = false
                }

                await syncAfterServerTurn(sessionId: response.sessionId)

                if config.soundEffects {
                    audioPlayback.playNotificationSound()
                }
                if config.autoSpeak {
                    audioPlayback.speak(text: reply)
                }
            } catch {
                if let index = messages.firstIndex(where: { $0.id == pendingAssistantMessage.id }) {
                    messages[index].text = "Erro: \(error.localizedDescription)"
                    messages[index].isSending = false
                    messages[index].error = error.localizedDescription
                }
                errorMessage = error.localizedDescription
                showErrorAlert = true
            }
            isSending = false
        }
    }

    public func startVoiceRecording() {
        guard !isRecording, !isSending, canSendMessages else { return }
        do {
            _ = try audioRecorder.startRecording()
            isRecording = true
        } catch {
            errorMessage = "Erro ao iniciar microfone: \(error.localizedDescription)"
            showErrorAlert = true
        }
    }

    public func stopAndSendVoiceRecording() {
        guard isRecording else { return }
        isRecording = false
        guard let fileUrl = audioRecorder.stopRecording() else { return }

        let config = storage.loadConfig()
        guard config.isValid else {
            errorMessage = "Configure a conexão nas Configurações."
            showErrorAlert = true
            return
        }

        let userMessage = ChatMessage(role: .user, text: "🎙️ Áudio gravado...", isAudio: true)
        messages.append(userMessage)

        let pendingAssistant = ChatMessage(role: .assistant, text: "Transcrevendo áudio...", isSending: true)
        messages.append(pendingAssistant)
        isSending = true

        Task {
            do {
                let response = try await apiClient.sendAudio(
                    fileUrl: fileUrl,
                    config: config,
                    sessionId: selectedSessionId
                )

                if let transcript = response.transcription, !transcript.isEmpty {
                    if let userIdx = messages.firstIndex(where: { $0.id == userMessage.id }) {
                        messages[userIdx].text = transcript
                    }
                }

                let reply = response.reply ?? "Áudio processado."
                if let asstIdx = messages.firstIndex(where: { $0.id == pendingAssistant.id }) {
                    messages[asstIdx].text = reply
                    messages[asstIdx].isSending = false
                }

                if config.soundEffects {
                    audioPlayback.playNotificationSound()
                }
                if config.autoSpeak {
                    audioPlayback.speak(text: reply)
                }
                await syncAfterServerTurn(sessionId: response.sessionId)
            } catch {
                if let asstIdx = messages.firstIndex(where: { $0.id == pendingAssistant.id }) {
                    messages[asstIdx].text = "Erro: \(error.localizedDescription)"
                    messages[asstIdx].isSending = false
                    messages[asstIdx].error = error.localizedDescription
                }
                errorMessage = error.localizedDescription
                showErrorAlert = true
            }
            isSending = false
            try? FileManager.default.removeItem(at: fileUrl)
        }
    }

    public func cancelVoiceRecording() {
        isRecording = false
        audioRecorder.cancelRecording()
    }

    public func toggleLiveDictation() {
        if isDictating {
            stopLiveDictation()
        } else {
            startLiveDictation()
        }
    }

    public func startLiveDictation() {
        guard !isDictating, !isSending, canSendMessages else { return }
        isDictating = true
        liveSpeech.startDictation(
            onPartialText: { [weak self] transcript in
                self?.inputText = transcript
            },
            onError: { [weak self] error in
                self?.isDictating = false
                self?.errorMessage = error.localizedDescription
                self?.showErrorAlert = true
            }
        )
    }

    public func stopLiveDictation() {
        guard isDictating else { return }
        liveSpeech.stopDictation()
        isDictating = false
    }

    public func speakMessage(_ text: String) {
        if audioPlayback.isSpeaking {
            audioPlayback.stop()
        } else {
            audioPlayback.speak(text: text)
        }
    }

    public func startNewConversation(mode: ConversationResetMode = .new) {
        let config = storage.loadConfig()
        guard config.isValid else {
            errorMessage = "Configure a URL do servidor e a Chave de API nas Configurações."
            showErrorAlert = true
            return
        }

        Task {
            do {
                let response = try await apiClient.beginNewConversation(config: config, mode: mode)
                messages.removeAll()
                hasMoreHistory = false
                currentHistoryLimit = 25
                await syncAfterServerTurn(sessionId: response.sessionId)
            } catch {
                errorMessage = error.localizedDescription
                showErrorAlert = true
            }
        }
    }

    public func clearConversation() {
        startNewConversation()
    }
}
