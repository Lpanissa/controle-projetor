import React from 'react';
import { ScrollView, Text, View } from 'react-native';

/** Mostra o erro na tela (tire um print e mande para o Claude). */
export default function ErrorScreen({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0b0d10', paddingTop: 50, paddingHorizontal: 18 }}>
      <Text style={{ color: '#ff4d4f', fontSize: 18, fontWeight: '700', marginBottom: 6 }}>O app encontrou um erro</Text>
      <Text style={{ color: '#8a93a0', fontSize: 13, marginBottom: 14 }}>
        Tire um print desta tela e mande na conversa com o Claude.
      </Text>
      <ScrollView style={{ flex: 1 }}>
        <Text selectable style={{ color: '#e9edf2', fontSize: 12, fontFamily: 'monospace' }}>
          {message}
        </Text>
      </ScrollView>
    </View>
  );
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: any) {
    return { error: `${e?.name || 'Erro'}: ${e?.message || e}\n\n${e?.stack || ''}` };
  }
  render() {
    if (this.state.error) return <ErrorScreen message={this.state.error} />;
    return this.props.children;
  }
}
