import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#edf5fb"
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
    borderColor: "#d8e4ef",
    marginBottom: 18
  },
  title: {
    color: "#17324d",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8
  },
  body: {
    color: "#61778f",
    fontSize: 15,
    lineHeight: 22
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#d8e4ef"
  },
  tileTitle: {
    color: "#17324d",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#eaf4fd",
    color: "#2274b9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10
  },
  sectionTitle: {
    color: "#17324d",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 8
  },
  statusText: {
    color: "#356994",
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
    backgroundColor: "#2274b9",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#e8f5ee",
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
    color: "#1f8f67",
    fontWeight: "700"
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  pill: {
    backgroundColor: "#eef6fc",
    color: "#275783",
    borderWidth: 1,
    borderColor: "#d9e9f7",
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
    backgroundColor: "#f2f8fd",
    borderWidth: 1,
    borderColor: "#d8e4ef",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  selectedChip: {
    backgroundColor: "#2274b9",
    borderWidth: 1,
    borderColor: "#2274b9",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  chipText: {
    color: "#2f5f8e",
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
    borderColor: "#d8e4ef",
    backgroundColor: "#f9fbfe",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#17324d",
    textAlignVertical: "top",
    marginBottom: 12
  }
});
