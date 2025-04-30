<template>
  <div class="web-terminal-container" ref="terminalContainer"></div>
</template>

<script setup>
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
// import { AttachAddon } from '@xterm/addon-attach';
import '@xterm/xterm/css/xterm.css';
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
  namespace: { type: String, required: true },
  podName: { type: String, required: true },
  containerName: { type: String, required: true },
  // Optional: Add a prop to trigger connection explicitly if needed
  // connect: { type: Boolean, default: false } 
});

const terminalContainer = ref(null);
let term = null;
let ws = null;
let fitAddon = null;
let resizeObserver = null;
let debounceResizeTimeout = null;

const WS_BASE_URL = `ws://${window.location.host}`; // Assuming backend is served on same host

function initializeTerminal() {
  if (!terminalContainer.value || term) {
    console.warn("Terminal container not ready or terminal already initialized.");
    return;
  }

  console.log(`Initializing terminal for ${props.namespace}/${props.podName}/${props.containerName}`);

  term = new Terminal({
    cursorBlink: true,
    rows: 24, // Default rows
    cols: 80, // Default columns
    theme: { // Example theme (customize as needed)
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
    }
  });

  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  term.open(terminalContainer.value);
  
  // Fit after a short delay to ensure layout is stable
  setTimeout(() => {
      try {
        fitAddon?.fit(); 
      } catch(e) {
        console.error("Initial fit failed:", e);
      }
  }, 50);

  // Setup resize observer
  resizeObserver = new ResizeObserver(() => {
    clearTimeout(debounceResizeTimeout);
    debounceResizeTimeout = setTimeout(() => {
      try {
        fitAddon?.fit(); 
      } catch (e) {
        console.warn("Fit addon resize error:", e);
      }
    }, 100); 
  });
  resizeObserver.observe(terminalContainer.value);

  // Establish WebSocket connection
  connectWebSocket();

  // Handle user input
  term.onData(data => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Send data prefixing with '0' for stdin (like k8s protocol)
      ws.send('0' + data); 
    }
  });

  // Handle terminal resize events to send to backend
  term.onResize(({ cols, rows }) => {
    console.log(`Terminal resized to ${cols}x${rows}`);
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Send resize command (channel '4' + JSON payload)
      const resizeMsg = JSON.stringify({ Width: cols, Height: rows });
      ws.send('4' + resizeMsg); 
    }
  });
}

function connectWebSocket() {
  const wsUrl = `${WS_BASE_URL}/api/pods/${props.namespace}/${props.podName}/exec?container=${props.containerName}`;
  console.log("Connecting WebSocket to:", wsUrl);

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("WebSocket connection established");
    term?.writeln('\r\n\x1b[32m--- Connection Established ---\x1b[0m\r\n');
    // Initial resize command after connection
     if (term) {
        const resizeMsg = JSON.stringify({ Width: term.cols, Height: term.rows });
        ws.send('4' + resizeMsg);
    }
  };

  ws.onmessage = (event) => {
    // Assuming backend prefixes with channel number (e.g., '1' stdout, '2' stderr)
    if (typeof event.data === 'string' && event.data.length > 0) {
        const channel = event.data[0];
        const data = event.data.substring(1);
        switch (channel) {
            case '1': // stdout
                term?.write(data);
                break;
            case '2': // stderr - write in red
                term?.write(`\x1b[31m${data}\x1b[0m`);
                break;
            case '3': // K8s error channel - display?
                 term?.write(`\r\n\x1b[91m--- K8s Error: ${data} ---\x1b[0m\r\n`);
                 break;
            default:
                console.warn("Received message on unknown channel:", channel, data);
                term?.write(event.data); // Fallback: write raw data
        }
    } else {
        // Handle binary data if necessary 
         console.log("Received binary WS data (potentially K8s message format):");
         // K8s exec protocol uses a leading byte for the stream ID (0=stdin, 1=stdout, 2=stderr, 3=error)
         // Need to handle ArrayBuffer or Blob
         if (event.data instanceof Blob) {
           const reader = new FileReader();
           reader.onload = () => {
               const arrayBuffer = reader.result;
               const view = new DataView(arrayBuffer);
               if (view.byteLength > 0) {
                   const channel = view.getUint8(0);
                   const data = new TextDecoder().decode(arrayBuffer.slice(1));
                   handleStreamData(channel, data);
               }
           };
           reader.onerror = (err) => console.error("Error reading blob:", err);
           reader.readAsArrayBuffer(event.data);
         } else if (event.data instanceof ArrayBuffer) {
             const view = new DataView(event.data);
             if (view.byteLength > 0) {
                 const channel = view.getUint8(0);
                 const data = new TextDecoder().decode(event.data.slice(1));
                 handleStreamData(channel, data);
             }
         } else {
             console.warn("Received unexpected WS data type:", typeof event.data);
         }
    }
  };

  // Helper function to handle decoded stream data
  function handleStreamData(channel, data) {
      switch (channel) {
          case 1: // stdout
              term?.write(data);
              break;
          case 2: // stderr
              term?.write(`\x1b[31m${data}\x1b[0m`); // Write stderr in red
              break;
          case 3: // error
              term?.write(`\r\n\x1b[91m--- K8s Error: ${data} ---\x1b[0m\r\n`);
              break;
          default:
              console.warn("Received message on unknown binary channel:", channel, data);
      }
  }

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    term?.writeln(`\r\n\x1b[91m--- WebSocket Error: ${error.message || 'Check backend logs for details'} ---\x1b[0m\r\n`);
  };

  ws.onclose = (event) => {
    console.log("WebSocket connection closed:", event.code, event.reason);
    term?.writeln(`\r\n\x1b[91m--- Connection Closed (Code: ${event.code}, Reason: ${event.reason || 'No reason given'}) ---\x1b[0m\r\n`);
    // Optionally disable terminal input here
    if (term) {
      term.options.cursorBlink = false;
      term.options.disableStdin = true;
      // Optionally add a visual indication
      term.writeln('\r\n[Disconnected]');
      term.blur(); // Remove focus
    }
  };
}

function cleanup() {
  console.log("Cleaning up WebTerminal component");
  if (resizeObserver && terminalContainer.value) {
    resizeObserver.unobserve(terminalContainer.value);
  }
  resizeObserver = null;
  
  if (ws) {
    ws.close();
    ws = null;
  }
  if (term) {
    term.dispose();
    term = null;
  }
  clearTimeout(debounceResizeTimeout);
}

// Watch for prop changes to potentially reconnect (optional)
// watch(() => [props.namespace, props.podName, props.containerName], () => {
//   console.log("WebTerminal props changed, recreating connection.");
//   cleanup();
//   initializeTerminal();
// });

onMounted(() => {
  setTimeout(initializeTerminal, 100); 
});

onBeforeUnmount(() => {
  cleanup();
});

</script>

<style scoped>
.web-terminal-container {
  width: 100%;
  height: 100%; /* Make sure the container has a defined height */
  background-color: #1e1e1e; /* Match terminal background */
  overflow: hidden; /* Prevent scrollbars on container */
}

/* Ensure the terminal takes up the full space */
:deep(.terminal),
:deep(.xterm-viewport),
:deep(.xterm-screen) {
    width: 100% !important;
    height: 100% !important;
}
</style> 