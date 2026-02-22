import { t } from '../../lib/i18n.js';

export function Contact() {
    return `
    <div class="flex-1 w-full max-w-5xl mx-auto px-4 py-12 md:py-20 flex flex-col md:flex-row gap-12">
      
      <!-- Contact Info -->
      <div class="flex-1">
        <h1 class="text-4xl font-heading font-bold text-text mb-4">Get in Touch</h1>
        <p class="text-lg text-muted mb-8">We are here to help and answer any question you might have. We look forward to hearing from you.</p>
        
        <div class="space-y-6">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </div>
            <div>
              <h3 class="font-bold text-text mb-1">Our Location</h3>
              <p class="text-muted text-sm">Wasfi Al-Tal Street, Building 42<br>Amman, Jordan</p>
            </div>
          </div>
          
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            </div>
            <div>
              <h3 class="font-bold text-text mb-1">Phone Number</h3>
              <p class="text-muted text-sm">+962 79 000 0000<br>+962 6 500 0000</p>
            </div>
          </div>

          <div class="flex items-start gap-4">
            <div class="w-12 h-12 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center shrink-0">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
              <h3 class="font-bold text-text mb-1">Working Hours</h3>
              <p class="text-muted text-sm">Saturday - Thursday<br>9:00 AM - 6:00 PM</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Contact Form -->
      <div class="flex-1 bg-surface border border-border rounded-2xl p-8">
        <h3 class="text-2xl font-heading font-bold text-text mb-6">Send us a Message</h3>
        <form class="space-y-4" onsubmit="event.preventDefault(); window.toast('Message sent successfully. We will contact you soon.', 'success'); this.reset();">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-text mb-1">First Name</label>
              <input type="text" required class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors">
            </div>
            <div>
              <label class="block text-sm font-medium text-text mb-1">Last Name</label>
              <input type="text" required class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Email Address</label>
            <input type="email" required class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors">
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Message</label>
            <textarea required rows="4" class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors resize-none"></textarea>
          </div>
          <button type="submit" class="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold transition-all">
            Send Message
          </button>
        </form>
      </div>

    </div>
  `;
}
