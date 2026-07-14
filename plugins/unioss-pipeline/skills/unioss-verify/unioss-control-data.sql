-- Change admin passwords to `password`
UPDATE `admins` SET `password` = '$2y$10$iTrdiYpvO1rXZgKftjzjsuvOTzUPkrJEZgwT4.5Ca/oiukMEKqk7O';

-- Change unioss_users password to `password`
UPDATE `unioss_users` SET `password` = '$2y$10$iTrdiYpvO1rXZgKftjzjsuvOTzUPkrJEZgwT4.5Ca/oiukMEKqk7O';

-- Change jtb_furupo_accounts password to `password`
UPDATE `jtb_furupo_accounts` SET `password` = '$2y$10$iTrdiYpvO1rXZgKftjzjsuvOTzUPkrJEZgwT4.5Ca/oiukMEKqk7O';

-- Change vending machines access ID & CODE to `secret`
UPDATE `vending_machines` SET `vending_access_id` = 'secret', `vending_access_code` = 'secret';
