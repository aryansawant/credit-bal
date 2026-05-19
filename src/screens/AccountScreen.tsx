import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppButton, SummaryCard } from "../components";
import { colors, radii, spacing } from "../styles/theme";
import type { CloudSession } from "../services/cloudAccount";

type AccountScreenProps = {
  error: string | null;
  lastSyncedAt: string | null;
  loading: boolean;
  session: CloudSession | null;
  onDownloadCloud: () => void;
  onSignIn: (email: string, password: string) => void;
  onSignOut: () => void;
  onSignUp: (email: string, password: string) => void;
  onUploadDevice: () => void;
};

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Not synced";
}

export function AccountScreen({
  error,
  lastSyncedAt,
  loading,
  session,
  onDownloadCloud,
  onSignIn,
  onSignOut,
  onSignUp,
  onUploadDevice,
}: AccountScreenProps) {
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [password, setPassword] = useState("");

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {session ? (
          <SummaryCard title="Signed in">
            <View style={styles.panel}>
              <View style={styles.row}>
                <Text style={styles.label}>Email</Text>
                <Text numberOfLines={1} style={styles.value}>
                  {session.user.email ?? "Signed in"}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Last synced</Text>
                <Text style={styles.value}>{formatTimestamp(lastSyncedAt)}</Text>
              </View>
              <View style={styles.actions}>
                <AppButton
                  disabled={loading}
                  label="Upload this device"
                  loading={loading}
                  onPress={onUploadDevice}
                />
                <AppButton
                  disabled={loading}
                  label="Restore cloud data"
                  onPress={onDownloadCloud}
                  variant="secondary"
                />
                <AppButton
                  disabled={loading}
                  label="Sign out"
                  onPress={onSignOut}
                  variant="ghost"
                />
              </View>
            </View>
          </SummaryCard>
        ) : (
          <SummaryCard title="Sign in">
            <View style={styles.form}>
              <View style={styles.group}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={email}
                />
              </View>
              <View style={styles.group}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  onChangeText={setPassword}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
              </View>
              <View style={styles.actions}>
                <AppButton
                  disabled={loading}
                  label="Sign in"
                  loading={loading}
                  onPress={() => onSignIn(email.trim(), password)}
                />
                <AppButton
                  disabled={loading}
                  label="Create account"
                  onPress={() => onSignUp(email.trim(), password)}
                  variant="secondary"
                />
              </View>
            </View>
          </SummaryCard>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <SummaryCard title="What sync saves">
          <Text style={styles.helper}>
            Your credit cards, payoff plans, debit cards, expenses, and check-ins
            are saved to your Supabase account. Bank API secrets and Plaid access
            tokens stay on the backend.
          </Text>
        </SummaryCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  panel: {
    gap: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  group: {
    gap: spacing.xs,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  value: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: colors.red,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
});
