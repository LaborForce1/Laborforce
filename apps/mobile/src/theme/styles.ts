import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef4fb"
  },
  screenContent: {
    padding: 20,
    paddingBottom: 40
  },
  hero: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d7e2ee",
    marginBottom: 18
  },
  title: {
    color: "#17263b",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8
  },
  body: {
    color: "#62748a",
    fontSize: 15,
    lineHeight: 22
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#d7e2ee"
  },
  tileTitle: {
    color: "#17263b",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#eaf3ff",
    color: "#2f5f8e",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10
  },
  sectionTitle: {
    color: "#17263b",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 8
  },
  statusText: {
    color: "#4f6d8f",
    fontSize: 14,
    marginTop: 10
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#1f6fd1",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#eef5fc",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButtonText: {
    color: "#335f92",
    fontWeight: "700"
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  pill: {
    backgroundColor: "#eef5fc",
    color: "#2f5f8e",
    borderWidth: 1,
    borderColor: "#d7e6f6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: "hidden"
  },
  chipScroller: {
    marginTop: 12,
    marginBottom: 12
  },
  chip: {
    backgroundColor: "#f1f6fb",
    borderWidth: 1,
    borderColor: "#d7e2ee",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  selectedChip: {
    backgroundColor: "#1f6fd1",
    borderWidth: 1,
    borderColor: "#1f6fd1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  chipText: {
    color: "#365f8b",
    fontWeight: "600"
  },
  selectedChipText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  input: {
    minHeight: 90,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d7e2ee",
    backgroundColor: "#f9fbff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#17263b",
    textAlignVertical: "top",
    marginBottom: 12
  }
});
