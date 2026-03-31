import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { JobListing, MessageConversation, User, UserTag } from "@laborforce/shared";
import { roleCards } from "../data/mock";
import { styles } from "../theme/styles";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";

const demoAccounts = {
  employer: {
    email: "dispatch@northsidehvac.com",
    password: "LaborForce123!"
  },
  employee: {
    email: "maria@laborforce.app",
    password: "LaborForce123!"
  }
} as const;

interface AuthResponse {
  user: User;
  credentials: {
    accessToken: string;
    refreshToken: string;
  };
}

interface JobsResponse {
  radiusMiles: number;
  items: JobListing[];
}

interface ConversationsResponse {
  items: MessageConversation[];
}

export function HomeScreen() {
  const [selectedTag, setSelectedTag] = useState<UserTag>("employee");
  const [auth, setAuth] = useState<AuthResponse["credentials"] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [conversations, setConversations] = useState<MessageConversation[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [statusMessage, setStatusMessage] = useState("Login with a demo account to load live jobs and verified messages.");
  const [isLoading, setIsLoading] = useState(false);
  const unreadCount = useMemo(
    () => conversations.reduce((total, conversation) => total + conversation.unreadCount, 0),
    [conversations]
  );

  useEffect(() => {
    void loadJobs();
  }, []);

  useEffect(() => {
    if (!auth?.accessToken || !user) {
      setConversations([]);
      setDirectoryUsers([]);
      return;
    }

    void loadConversations(auth.accessToken);
    void loadDirectoryUsers(auth.accessToken, user.id);
  }, [auth, user]);

  async function apiRequest<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown; token?: string | null } = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? `Request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async function loadJobs() {
    try {
      const response = await apiRequest<JobsResponse>("/jobs");
      setJobs(response.items);
    } catch {
      setStatusMessage("Could not load jobs. Make sure the API is running on your computer.");
    }
  }

  async function loadConversations(token: string) {
    try {
      const response = await apiRequest<ConversationsResponse>("/messages", { token });
      setConversations(response.items);
    } catch {
      setConversations([]);
    }
  }

  async function loadDirectoryUsers(token: string, currentUserId: string) {
    try {
      const response = await apiRequest<User[]>("/users", { token });
      setDirectoryUsers(response.filter((candidate) => candidate.id !== currentUserId && candidate.isVerified));
    } catch {
      setDirectoryUsers([]);
    }
  }

  async function handleDemoLogin(role: "employer" | "employee") {
    setIsLoading(true);
    setStatusMessage("Signing in...");

    try {
      const response = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: demoAccounts[role]
      });

      setAuth(response.credentials);
      setUser(response.user);
      setSelectedTag(response.user.userTag);
      setStatusMessage(`Signed in as ${response.user.fullName}.`);
      await loadConversations(response.credentials.accessToken);
      await loadDirectoryUsers(response.credentials.accessToken, response.user.id);
      await loadJobs();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendMessage() {
    if (!auth?.accessToken || !selectedRecipientId) {
      setStatusMessage("Pick a verified person first.");
      return;
    }

    if (!messageText.trim()) {
      setStatusMessage("Type a message first.");
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest("/messages", {
        method: "POST",
        token: auth.accessToken,
        body: {
          recipientId: selectedRecipientId,
          messageText: messageText.trim()
        }
      });

      setMessageText("");
      setStatusMessage("Message sent.");
      await loadConversations(auth.accessToken);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <StatusBar style="dark" />

      <View style={styles.hero}>
        <Text style={styles.badge}>LaborForce Mobile Beta</Text>
        <Text style={styles.title}>LinkedIn style for the trades</Text>
        <Text style={styles.body}>
          Live jobs, verified messaging, and simple demo login so the app version is useful right now.
        </Text>
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>

      <Text style={styles.sectionTitle}>Choose your role</Text>
      {roleCards.map((role) => (
        <TouchableOpacity key={role.tag} style={styles.card} onPress={() => setSelectedTag(role.tag)}>
          <Text style={styles.badge}>{selectedTag === role.tag ? "Selected" : "Tap to select"}</Text>
          <Text style={styles.tileTitle}>{role.title}</Text>
          <Text style={styles.body}>{role.body}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Quick demo login</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleDemoLogin("employer")}>
          <Text style={styles.buttonText}>{isLoading ? "Working..." : "Employer login"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleDemoLogin("employee")}>
          <Text style={styles.secondaryButtonText}>{isLoading ? "Working..." : "Worker login"}</Text>
        </TouchableOpacity>
      </View>

      {user && (
        <View style={styles.card}>
          <Text style={styles.tileTitle}>{user.fullName}</Text>
          <Text style={styles.body}>{user.tradeType ?? user.businessName ?? user.userTag}</Text>
          <View style={styles.pillRow}>
            <Text style={styles.pill}>{user.verificationStatus}</Text>
            <Text style={styles.pill}>{conversations.length} chats</Text>
            <Text style={styles.pill}>{unreadCount} unread</Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Live jobs</Text>
      {jobs.slice(0, 4).map((job) => (
        <View key={job.id} style={styles.card}>
          <Text style={styles.tileTitle}>{job.jobTitle}</Text>
          <Text style={styles.body}>{job.tradeCategory} • {job.countyLocation}</Text>
          <Text style={styles.body}>${job.hourlyRateMin} - ${job.hourlyRateMax} • {job.status}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Verified messages</Text>
      <View style={styles.card}>
        <Text style={styles.body}>Only verified users can message each other.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
          {directoryUsers.map((candidate) => (
            <TouchableOpacity
              key={candidate.id}
              style={selectedRecipientId === candidate.id ? styles.selectedChip : styles.chip}
              onPress={() => setSelectedRecipientId(candidate.id)}
            >
              <Text style={selectedRecipientId === candidate.id ? styles.selectedChipText : styles.chipText}>
                {candidate.fullName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput
          style={styles.input}
          placeholder="Type a message"
          placeholderTextColor="#7a9488"
          value={messageText}
          onChangeText={setMessageText}
          multiline
        />
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSendMessage()}>
          <Text style={styles.buttonText}>Send verified message</Text>
        </TouchableOpacity>
      </View>

      {conversations.map((conversation) => (
        <View key={conversation.conversationId} style={styles.card}>
          <Text style={styles.tileTitle}>{conversation.participant.fullName}</Text>
          <Text style={styles.body}>
            {conversation.participant.tradeType ?? conversation.participant.businessName ?? conversation.participant.userTag}
          </Text>
          <Text style={styles.body}>{conversation.latestMessage.messageText}</Text>
          <View style={styles.pillRow}>
            <Text style={styles.pill}>{conversation.unreadCount} unread</Text>
            <Text style={styles.pill}>{conversation.participant.verificationStatus}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
