import axios from 'axios';

/**
 * We'll load the axios HTTP library which allows us to easily issue requests
 * to our Laravel back-end. This library automatically handles sending the
 * CSRF token as a header based on the value of the "XSRF" token cookie.
 */

(window as any).axios = axios;

(window as any).axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
