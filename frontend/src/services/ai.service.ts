import { http } from './http';

export const aiService = {
  chat: (question: string) => {
    const form = new FormData();
    form.append('question', question);
    return http.post<{ answer: string }>('/ai/chat', form);
  },

  suggestions: () => http.get<{ suggestions: string[] }>('/ai/suggestions'),
};
