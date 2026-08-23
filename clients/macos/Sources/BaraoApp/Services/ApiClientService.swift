import Foundation

public final class ApiClientService: ApiClientProtocol {
    public static let shared = ApiClientService()
    private let urlSession: URLSession
    
    public init(urlSession: URLSession = .shared) {
        self.urlSession = urlSession
    }
    
    private func createRequest(url: URL, method: String, config: AppConfig, contentType: String = "application/json") -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(config.apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 90
        return request
    }
    
    public func verifyConnection(config: AppConfig) async throws -> Bool {
        guard let url = URL(string: "\(config.serverUrl)/api/mac/verify?group=\(config.groupFolder)") else {
            throw URLError(.badURL)
        }
        let request = createRequest(url: url, method: "GET", config: config)
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            return false
        }
        let verify = try? JSONDecoder().decode(VerifyResponse.self, from: data)
        return verify?.success == true
    }
    
    public func sendPrompt(_ prompt: String, config: AppConfig, sessionId: String? = nil) async throws -> PromptResponse {
        guard let url = URL(string: "\(config.serverUrl)/api/mac/prompt?group=\(config.groupFolder)") else {
            throw URLError(.badURL)
        }
        var request = createRequest(url: url, method: "POST", config: config)
        var payload: [String: Any] = ["prompt": prompt]
        if let sessionId, !sessionId.isEmpty {
            payload["sessionId"] = sessionId
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        if httpResponse.statusCode != 200 {
            if let errObj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let errMsg = errObj["error"] as? String {
                throw NSError(domain: "BaraoApi", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errMsg])
            }
            throw NSError(domain: "BaraoApi", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Erro de servidor (\(httpResponse.statusCode))"])
        }
        
        return try JSONDecoder().decode(PromptResponse.self, from: data)
    }
    
    public func sendAudio(fileUrl: URL, config: AppConfig, sessionId: String? = nil) async throws -> AudioResponse {
        guard let url = URL(string: "\(config.serverUrl)/api/mac/audio?group=\(config.groupFolder)") else {
            throw URLError(.badURL)
        }
        
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = createRequest(url: url, method: "POST", config: config, contentType: "multipart/form-data; boundary=\(boundary)")
        
        let audioData = try Data(contentsOf: fileUrl)
        var body = Data()
        
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"audio_file\"; filename=\"recording.m4a\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/m4a\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n".data(using: .utf8)!)
        if let sessionId, !sessionId.isEmpty {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"sessionId\"\r\n\r\n".data(using: .utf8)!)
            body.append(sessionId.data(using: .utf8)!)
            body.append("\r\n".data(using: .utf8)!)
        }
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        let (data, response) = try await urlSession.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        if httpResponse.statusCode != 200 {
            if let errObj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let errMsg = errObj["error"] as? String {
                throw NSError(domain: "BaraoApi", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errMsg])
            }
            throw NSError(domain: "BaraoApi", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Falha no envio de áudio (\(httpResponse.statusCode))"])
        }
        
        return try JSONDecoder().decode(AudioResponse.self, from: data)
    }
    
    public func fetchThreads(config: AppConfig, limit: Int = 50) async throws -> [ChatThread] {
        guard let url = URL(string: "\(config.serverUrl)/api/mac/threads?limit=\(limit)&group=\(config.groupFolder)") else {
            throw URLError(.badURL)
        }
        let request = createRequest(url: url, method: "GET", config: config)
        let (data, response) = try await urlSession.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            return []
        }
        let res = try JSONDecoder().decode(ThreadsResponse.self, from: data)
        return res.threads ?? []
    }

    public func fetchHistory(config: AppConfig, limit: Int = 50, sessionId: String? = nil) async throws -> [ChatMessage] {
        var urlString = "\(config.serverUrl)/api/mac/history?limit=\(limit)&group=\(config.groupFolder)"
        if let sessionId, !sessionId.isEmpty {
            urlString += "&sessionId=\(sessionId)"
        }
        guard let url = URL(string: urlString) else {
            throw URLError(.badURL)
        }
        let request = createRequest(url: url, method: "GET", config: config)
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            return []
        }
        
        let res = try JSONDecoder().decode(HistoryResponse.self, from: data)
        guard let list = res.messages else { return [] }
        
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        var chatMessages = list.compactMap { dto -> ChatMessage? in
            let date = isoFormatter.date(from: dto.timestamp) ?? ISO8601DateFormatter().date(from: dto.timestamp) ?? Date()
            let role: ChatMessage.Role = dto.role == "assistant" ? .assistant : .user
            return ChatMessage(
                id: dto.id ?? UUID().uuidString,
                role: role,
                text: dto.text,
                timestamp: date,
                isAudio: false,
                isSending: false
            )
        }
        
        chatMessages.sort { a, b in
            if a.timestamp != b.timestamp {
                return a.timestamp < b.timestamp
            }
            return a.role == .user && b.role == .assistant
        }
        
        return chatMessages
    }
    
    public func beginNewConversation(
        config: AppConfig,
        mode: ConversationResetMode = .new
    ) async throws -> ResetResponse {
        guard let url = URL(string: "\(config.serverUrl)/api/mac/reset?group=\(config.groupFolder)") else {
            throw URLError(.badURL)
        }
        var request = createRequest(url: url, method: "POST", config: config)
        request.httpBody = try JSONSerialization.data(withJSONObject: ["mode": mode.rawValue])

        let (data, response) = try await urlSession.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        if httpResponse.statusCode != 200 {
            if let errObj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let errMsg = errObj["error"] as? String {
                throw NSError(domain: "BaraoApi", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errMsg])
            }
            throw NSError(domain: "BaraoApi", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Erro ao iniciar nova conversa (\(httpResponse.statusCode))"])
        }

        return try JSONDecoder().decode(ResetResponse.self, from: data)
    }
}
