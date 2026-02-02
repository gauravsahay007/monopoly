import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import Rules from '../views/Rules.vue';
import Room from '../views/Room.vue';

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home
    },
    {
        path: '/rules',
        name: 'Rules',
        component: Rules
    },
    {
        path: '/room/:roomId',
        name: 'Room',
        component: Room,
        props: true
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

export default router;
