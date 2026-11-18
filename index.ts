// The app's entry. It starts the app as before, and registers the handler
// that draws the home-screen widget, which Android may run with the app closed.
import 'expo-router/entry';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widget/taskHandler';

if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
