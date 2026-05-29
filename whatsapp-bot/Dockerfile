FROM node:20-alpine

WORKDIR /app

# تثبيت التبعيات أولاً للاستفادة من طبقات الكاش
COPY package*.json ./
RUN npm install --omit=dev

# نسخ بقية ملفات البوت
COPY . .

EXPOSE 3001

CMD ["npm", "start"]
