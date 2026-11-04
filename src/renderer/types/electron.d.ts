import { ElectronApi } from '../../preload'

declare global {
  interface Window {
    api?: ElectronApi
  }
}
