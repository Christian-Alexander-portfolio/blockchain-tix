import { useRef } from 'react';
import { View, Modal, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface BraintreeWebViewProps {
  clientToken: string;
  amount: string;
  visible: boolean;
  onNonce: (nonce: string) => void;
  onCancel: () => void;
}

// The Braintree Drop-in UI HTML — hosted entirely in the WebView.
// It uses the Braintree JS SDK (loaded from Braintree's CDN) and posts
// the nonce back to React Native via window.ReactNativeWebView.postMessage.
function buildHtml(clientToken: string, amount: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #111827; font-family: -apple-system, sans-serif; padding: 24px; }
    h2 { color: white; font-size: 18px; margin-bottom: 16px; }
    #dropin-container { margin-bottom: 16px; }
    #submit-btn {
      width: 100%; background: #7C3AED; color: white;
      border: none; border-radius: 12px; padding: 16px;
      font-size: 16px; font-weight: 600; cursor: pointer;
    }
    #submit-btn:disabled { opacity: 0.5; }
    #error { color: #EF4444; margin-top: 12px; font-size: 14px; text-align: center; }
  </style>
</head>
<body>
  <h2>Payment — $${amount}</h2>
  <div id="dropin-container"></div>
  <button id="submit-btn" disabled>Processing...</button>
  <p id="error"></p>

  <script src="https://js.braintreegateway.com/web/dropin/1.43.0/js/dropin.min.js"></script>
  <script>
    braintree.dropin.create({
      authorization: '${clientToken}',
      container: '#dropin-container',
      paypal: { flow: 'vault' },
      applePay: {
        displayName: 'BlockchainTickets',
        paymentRequest: {
          total: { label: 'BlockchainTickets', amount: '${amount}' },
          countryCode: 'US',
          currencyCode: 'USD',
          merchantCapabilities: ['supports3DS'],
          supportedNetworks: ['visa', 'masterCard', 'amex'],
        },
      },
      googlePay: {
        googlePayVersion: 2,
        merchantId: 'BCR2DN4T',
        transactionInfo: {
          totalPriceStatus: 'FINAL',
          totalPrice: '${amount}',
          currencyCode: 'USD',
        },
      },
    }, function(err, instance) {
      if (err) {
        document.getElementById('error').textContent = err.message;
        return;
      }
      var btn = document.getElementById('submit-btn');
      btn.disabled = false;
      btn.textContent = 'Pay $${amount}';
      btn.addEventListener('click', function() {
        btn.disabled = true;
        btn.textContent = 'Processing...';
        instance.requestPaymentMethod(function(err, payload) {
          if (err) {
            document.getElementById('error').textContent = err.message;
            btn.disabled = false;
            btn.textContent = 'Pay $${amount}';
            return;
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({ nonce: payload.nonce }));
        });
      });
    });
  </script>
</body>
</html>`;
}

export function BraintreeWebView({ clientToken, amount, visible, onNonce, onCancel }: BraintreeWebViewProps) {
  const html = buildHtml(clientToken, amount);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-dark">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-700">
          <Text className="text-white font-semibold text-lg">Complete Payment</Text>
          <TouchableOpacity onPress={onCancel}>
            <Text className="text-gray-400">Cancel</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ html }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.nonce) onNonce(data.nonce);
            } catch {}
          }}
          startInLoadingState
          renderLoading={() => (
            <View className="flex-1 items-center justify-center bg-dark">
              <ActivityIndicator color="#7C3AED" />
            </View>
          )}
          style={{ flex: 1, backgroundColor: '#111827' }}
        />
      </View>
    </Modal>
  );
}
