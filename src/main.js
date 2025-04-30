import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

import Aura from '@primeuix/themes/aura';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import SelectButton from 'primevue/selectbutton';
import StyleClass from 'primevue/styleclass';
import Toast from 'primevue/toast';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';

import '@/assets/styles.scss';

const app = createApp(App);

app.use(router);
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            darkModeSelector: 'system',
            cssLayer: {
                name: 'primevue',
                order: 'tailwind-base, primevue, tailwind-utilities'
              }
        }
    }
});
app.use(ToastService);
app.use(ConfirmationService);

app.component('Toast', Toast);
app.component('SelectButton', SelectButton);

app.directive('styleclass', StyleClass);
app.directive('tooltip', Tooltip);

app.mount('#app');
