import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f2f1ff"
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
    borderColor: "#dddff6",
    marginBottom: 18
  },
  title: {
    color: "#1b2148",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8
  },
  body: {
    color: "#66709a",
    fontSize: 15,
    lineHeight: 22
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#dddff6"
  },
  tileTitle: {
    color: "#1b2148",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#edf1ff",
    color: "#4e46a8",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10
  },
  sectionTitle: {
    color: "#1b2148",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 8
  },
  statusText: {
    color: "#5a5bb2",
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
    backgroundColor: "#376dff",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#f0edff",
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
    color: "#6b4de6",
    fontWeight: "700"
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  pill: {
    backgroundColor: "#f0edff",
    color: "#4e46a8",
    borderWidth: 1,
    borderColor: "#dfd6ff",
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
    backgroundColor: "#f4f2ff",
    borderWidth: 1,
    borderColor: "#dddff6",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  selectedChip: {
    backgroundColor: "#6b4de6",
    borderWidth: 1,
    borderColor: "#6b4de6",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  chipText: {
    color: "#5548a5",
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
    borderColor: "#dddff6",
    backgroundColor: "#fafaff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1b2148",
    textAlignVertical: "top",
    marginBottom: 12
  }
});
