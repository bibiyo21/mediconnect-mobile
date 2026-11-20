import { Redirect } from 'expo-router';

/**
 * The 2.11 doctor list is replaced by search (increment 3.6). Old links to
 * /directory land on the search screen; the profile routes below stay.
 */
export default function Directory() {
  return <Redirect href="/search" />;
}
