import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * The questions a first-time visitor asks, each with its answer (/help). It reads nothing from the API. An answer
 * describes only what the app does today; a question about a page still to be converted is added with that page.
 */
@Component({
  selector: 'app-help',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './help.html',
})
export class HelpPage {}
