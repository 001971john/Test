import React from 'react';
import { Text, View, StyleSheet, Pressable } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../types';
import { HomeScreen } from '../screens/HomeScreen';
import { ScannerScreen } from '../screens/ScannerScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AssistantScreen } from '../screens/AssistantScreen';
import { ImageEditorScreen } from '../screens/ImageEditorScreen';
import { OCRResultScreen } from '../screens/OCRResultScreen';
import { ExportScreen } from '../screens/ExportScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const TabIcon = ({ icon, focused }: { icon: string; focused: boolean }) => (
  <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.45 }}>{icon}</Text>
);

// Raised circular camera button — the signature scanner-app center action.
const ScanTabButton = (props: React.ComponentProps<typeof Pressable>) => (
  <Pressable {...props} style={fabStyles.wrap}>
    <View style={fabStyles.button}>
      <Text style={fabStyles.icon}>📷</Text>
    </View>
    <Text style={fabStyles.label}>Scan</Text>
  </Pressable>
);

const fabStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -30,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  icon: { fontSize: 28 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
    marginTop: 3,
    marginBottom: 8,
  },
});

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E7EAF0',
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
        },
        headerStyle: {
          backgroundColor: '#4F46E5',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '700',
        },
        headerShadowVisible: false,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'My Documents',
          tabBarLabel: 'Documents',
          tabBarIcon: ({ focused }) => <TabIcon icon="📑" focused={focused} />,
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{
          title: 'Scan',
          tabBarButton: props => <ScanTabButton {...(props as object)} />,
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{
          title: 'Assistant',
          tabBarLabel: 'Assistant',
          tabBarIcon: ({ focused }) => <TabIcon icon="🤖" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#4F46E5' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}>
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ImageEditor"
          component={ImageEditorScreen}
          options={{ title: 'Edit Image' }}
        />
        <Stack.Screen
          name="OCRResult"
          component={OCRResultScreen}
          options={{ title: 'Extracted Data' }}
        />
        <Stack.Screen
          name="Export"
          component={ExportScreen}
          options={{ title: 'Export Document' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
