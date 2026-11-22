// Полифилл Buffer для @react-pdf/renderer. Импортируется первой строкой в модулях
// печати, поэтому попадает только в чанк PDF и не грузится на лендинге.
import { Buffer } from 'buffer';
if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}
