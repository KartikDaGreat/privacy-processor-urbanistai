# Sample image credits

The three starter photos bundled with this app are freely licensed and
self-hosted, so nothing is hotlinked and no third party sees who opens the app.

They were picked by running the app's own detectors over a pool of candidates
from Wikimedia Commons, choosing one photo where every model agrees, one where
they disagree sharply, and one of candid profiles rather than posed portraits.

| File | Author | Licence | Source |
|---|---|---|---|
| `group-of-five.jpg` | Dev Jadiya | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [Participants at Indic Wikimedia Hackathon Bhubaneswar 2024 5](https://commons.wikimedia.org/wiki/File:Participants_at_Indic_Wikimedia_Hackathon_Bhubaneswar_2024_5.jpg) |
| `large-group.jpg` | Jnanaranjan sahu | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [Indic Wikimedia Hackathon Hyderabad 2026 Group Photo](https://commons.wikimedia.org/wiki/File:Indic_Wikimedia_Hackathon_Hyderabad_2026_Group_Photo.jpg) |
| `family-at-table.jpg` | National Cancer Institute | Public domain | [Family eating meal](https://commons.wikimedia.org/wiki/File:Family_eating_meal.jpg) |

Each image was resized to 1400px on its long edge and re-encoded; the `-thumb`
variants are 400px wide and are what the picker loads. No other changes were
made. The CC BY images require attribution, which is shown in the app under the
sample picker as well as here.

Replacing a sample means dropping a new file in this directory and updating the
matching entry in `src/lib/samples.ts`.
