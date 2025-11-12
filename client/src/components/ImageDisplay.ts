import { ImageData } from '../types';
import { apiClient } from '../api/client';

export class ImageDisplay {
  private container: HTMLElement;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    this.container = container;
  }

  render(image: ImageData | null): void {
    if (!image || !image.filename) {
      this.container.innerHTML = '<p>No image available</p>';
      return;
    }

    const imageUrl = apiClient.getImageUrl(image.filename);

    this.container.innerHTML = `
      <div class="image-card">
        <h3>Camera Image</h3>
        <div class="image-container">
          <img src="${imageUrl}" alt="Greenhouse camera image" onerror="this.parentElement.innerHTML='<p>Image not found</p>'">
        </div>
      </div>
    `;
  }
}

