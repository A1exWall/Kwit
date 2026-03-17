import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "../../constants/colors";
import { supabase } from "../../lib/supabase";

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (data?.session) {
        router.replace("/onboarding/questions");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: Colors.background }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="flex-1 px-6"
      >
        <View className="flex-1 justify-center py-10">
          <Text
            className="text-2xl font-bold mb-2"
            style={{ color: Colors.primary }}
          >
            Sign in
          </Text>
          <Text
            className="text-base mb-6"
            style={{ color: Colors.midGrey }}
          >
            Welcome back. Sign in to continue.
          </Text>

          <TextInput
            className="w-full h-12 px-4 rounded-xl mb-3 border"
            style={{
              backgroundColor: Colors.background,
              borderColor: Colors.lightGrey,
              color: Colors.darkText,
            }}
            placeholder="Email"
            placeholderTextColor={Colors.midGrey}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!isLoading}
          />

          <TextInput
            className="w-full h-12 px-4 rounded-xl mb-4 border"
            style={{
              backgroundColor: Colors.background,
              borderColor: Colors.lightGrey,
              color: Colors.darkText,
            }}
            placeholder="Password"
            placeholderTextColor={Colors.midGrey}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null);
            }}
            secureTextEntry
            editable={!isLoading}
          />

          {error ? (
            <Text
              className="text-sm mb-4"
              style={{ color: "red" }}
            >
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSignIn}
            disabled={isLoading}
            className="h-14 rounded-full items-center justify-center mb-4"
            style={{
              backgroundColor: Colors.primary,
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Sign in
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.back()}
            disabled={isLoading}
            className="items-center py-2"
          >
            <Text
              className="text-base"
              style={{ color: Colors.primary }}
            >
              Don't have an account? Sign up
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
