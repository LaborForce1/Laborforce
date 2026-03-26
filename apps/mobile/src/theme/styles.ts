import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef7f1"
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
    borderColor: "#d6e7dc",
    marginBottom: 18
  },
  title: {
    color: "#143126",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8
  },
  body: {
    color: "#61786d",
    fontSize: 15,
    lineHeight: 22
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#d6e7dc"
  },
  tileTitle: {
    color: "#143126",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#e8f6ef",
    color: "#1d8f63",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10
  },
  sectionTitle: {
    color: "#143126",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 8
  },
  statusText: {
    color: "#3b6e57",
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
    backgroundColor: "#1d8f63",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#e6f0fb",
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
    color: "#3569a8",
    fontWeight: "700"
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  pill: {
    backgroundColor: "#eef8f2",
    color: "#21694f",
    borderWidth: 1,
    borderColor: "#d7eadf",
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
    backgroundColor: "#f3f8f5",
    borderWidth: 1,
    borderColor: "#d6e7dc",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  selectedChip: {
    backgroundColor: "#1d8f63",
    borderWidth: 1,
    borderColor: "#1d8f63",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  chipText: {
    color: "#295a46",
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
    borderColor: "#d6e7dc",
    backgroundColor: "#f9fcfa",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#143126",
    textAlignVertical: "top",
    marginBottom: 12
  }
});
