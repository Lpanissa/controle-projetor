import React from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../AppState';
import { projector, ProjectorApp } from '../lib/projector';
import { C } from '../theme';
import Icon from './Icon';

export function AppIcon({ pkg, size = 34 }: { pkg: string; size?: number }) {
  const { settings } = useApp();
  if (!settings.projectorIp) return <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: C.card2 }} />;
  return (
    <Image
      source={{ uri: projector.iconUrl(settings.projectorIp, pkg) }}
      style={{ width: size, height: size, borderRadius: 10 }}
      resizeMode="contain"
    />
  );
}

export default function AppPicker({
  visible, onClose, onPick, exclude = [], title = 'Escolher app do projetor',
}: { visible: boolean; onClose: () => void; onPick: (a: ProjectorApp) => void; exclude?: string[]; title?: string }) {
  const { apps, wifiOk } = useApp();
  const list = apps.filter((a) => !exclude.includes(a.pkg));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.back}>
        <View style={st.sheet}>
          <View style={st.top}>
            <Text style={st.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Icon name="close" color={C.mut} />
            </Pressable>
          </View>
          {!wifiOk ? (
            <Text style={st.empty}>Conecte o app ao projetor pelo Wi-Fi nos Ajustes para ver os apps instalados.</Text>
          ) : list.length === 0 ? (
            <Text style={st.empty}>Todos os apps já estão nos atalhos.</Text>
          ) : (
            <FlatList
              data={list}
              keyExtractor={(a) => a.pkg}
              numColumns={4}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [st.item, pressed && { opacity: 0.6 }]}
                  onPress={() => {
                    onPick(item);
                    onClose();
                  }}
                >
                  <AppIcon pkg={item.pkg} size={44} />
                  <Text style={st.label} numberOfLines={1}>{item.label}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  back: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: { maxHeight: '75%', backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: C.line, padding: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: C.txt, fontSize: 17, fontWeight: '700' },
  empty: { color: C.mut, fontSize: 14, paddingVertical: 30, textAlign: 'center' },
  item: { width: '25%', alignItems: 'center', paddingVertical: 10, gap: 6 },
  label: { color: C.mut, fontSize: 11, maxWidth: 76 },
});
