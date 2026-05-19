import DateTimePicker from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radii, spacing } from "../styles/theme";
import { formatDateLabel, parseISODate, toISODate } from "../utils/dateHelpers";
import { AppButton } from "./AppButton";

type DateInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  helper?: string;
};

export function DateInput({
  label,
  value,
  onChangeText,
  error,
  helper = "Tap to choose a date.",
}: DateInputProps) {
  const selectedDate = useMemo(() => parseISODate(value) ?? new Date(), [value]);
  const [modalVisible, setModalVisible] = useState(false);
  const [draftDate, setDraftDate] = useState(selectedDate);

  function openPicker() {
    setDraftDate(selectedDate);
    setModalVisible(true);
  }

  function closePicker() {
    setModalVisible(false);
  }

  function confirmPicker() {
    onChangeText(toISODate(draftDate));
    setModalVisible(false);
  }

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={openPicker}
        style={({ pressed }) => [
          styles.input,
          error && styles.inputError,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.inputText}>{formatDateLabel(value)}</Text>
        <Text style={styles.inputHint}>Change</Text>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={closePicker}
        transparent
        visible={modalVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <Text style={styles.modalDate}>{formatDateLabel(toISODate(draftDate))}</Text>
            </View>

            <DateTimePicker
              display={Platform.OS === "ios" ? "spinner" : "calendar"}
              mode="date"
              onChange={(_, date) => {
                if (date) {
                  setDraftDate(date);
                }
              }}
              themeVariant="dark"
              value={draftDate}
            />

            <View style={styles.modalActions}>
              <AppButton label="Cancel" onPress={closePicker} variant="secondary" />
              <AppButton label="Done" onPress={confirmPicker} />
            </View>
          </View>
        </View>
      </Modal>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  input: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputError: {
    borderColor: colors.red,
  },
  inputText: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },
  inputHint: {
    color: colors.green,
    fontSize: 14,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.72,
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
    padding: spacing.lg,
    width: "100%",
  },
  modalHeader: {
    gap: spacing.xs,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
  },
  modalDate: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  modalActions: {
    gap: spacing.sm,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 13,
  },
  error: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "700",
  },
});
