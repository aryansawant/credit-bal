import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing } from "../styles/theme";

type MoneyInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
};

export function MoneyInput({
  label,
  value,
  onChangeText,
  placeholder = "0",
  error,
  helper,
}: MoneyInputProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error && styles.inputError]}>
        <Text style={styles.prefix}>$</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={value}
        />
      </View>
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
  inputWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  inputError: {
    borderColor: colors.red,
  },
  prefix: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "700",
    marginRight: spacing.xs,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    paddingVertical: spacing.md,
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
