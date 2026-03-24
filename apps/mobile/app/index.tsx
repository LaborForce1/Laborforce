import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { UserTag } from "@laborforce/shared";
import { roleCards, mobileFeed } from "../src/data/mock";
import { styles } from "../src/theme/styles";

export default function HomeScreen() {
  const [selectedTag, setSelectedTag] = useState<UserTag>("employee");

  return (
    <ScrollView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.hero}>
        <Text style={styles.badge}>LaborForce Mobile</Text>
        <Text style={styles.title}>Verified local trades network</Text>
        <Text style={styles.body}>
          Choose a permanent role at onboarding, complete Persona verification, and unlock a role-based feed for jobs,
          Quick Cash, Proof Wall updates, messaging, and premium tools.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Choose your role</Text>
      {roleCards.map((role) => (
        <TouchableOpacity key={role.tag} style={styles.card} onPress={() => setSelectedTag(role.tag)}>
          <Text style={styles.badge}>{selectedTag === role.tag ? "Selected" : "Tap to select"}</Text>
          <Text style={styles.tileTitle}>{role.title}</Text>
          <Text style={styles.body}>{role.body}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Today on LaborForce</Text>
      <View style={styles.card}>
        <Text style={styles.tileTitle}>Job Feed</Text>
        <Text style={styles.body}>{mobileFeed.jobs[0].title}</Text>
        <Text style={styles.body}>{mobileFeed.jobs[0].meta}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.tileTitle}>Quick Cash</Text>
        <Text style={styles.body}>{mobileFeed.quickCash[0].title}</Text>
        <Text style={styles.body}>{mobileFeed.quickCash[0].meta}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.tileTitle}>Messages</Text>
        <Text style={styles.body}>{mobileFeed.messages[0].title}</Text>
        <Text style={styles.body}>{mobileFeed.messages[0].meta}</Text>
      </View>
    </ScrollView>
  );
}
