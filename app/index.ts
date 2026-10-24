import { registerRootComponent } from 'expo';
import React from 'react';
import { DeviceEventEmitter } from 'react-native';
import ErrorScreen from './src/ErrorScreen';

// Erros do app viram uma tela com o texto do erro (para corrigir), em vez de fechar o app.
const g: any = global;
const ErrorUtils = g.ErrorUtils;
if (ErrorUtils?.setGlobalHandler) {
  ErrorUtils.setGlobalHandler((error: any) => {
    const msg = `${error?.name || 'Erro'}: ${error?.message || error}\n\n${error?.stack || ''}`;
    g.__appError = msg;
    DeviceEventEmitter.emit('appError', msg);
  });
}

let Root: React.ComponentType;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Root = require('./App').default;
} catch (e: any) {
  const msg = `Erro ao carregar: ${e?.message || e}\n\n${e?.stack || ''}`;
  Root = () => React.createElement(ErrorScreen, { message: msg });
}

registerRootComponent(Root);
